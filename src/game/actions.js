import {
  db,
  ref,
  set,
  get,
  update,
  onDisconnect,
  push,
  isCurrentUserAdmin,
} from '../firebase.js';
import { getState, setState } from './state.js';
import { generateRoomCode } from '../utils/roomCode.js';
import { buildGameState, checkMajority } from './engine.js';
import { LOCATIONS } from '../data/locations.js';
import { navigate } from '../router.js';
import { getActivePlayers } from './state.js';
import { listenToRoom, stopListening } from './listeners.js';
import { LIMITS } from '../constants.js';

/** Persist detailed game history for dashboard analytics */
async function persistGameHistory(roomCode) {
  try {
    const snap = await get(ref(db, `rooms/${roomCode}`));
    if (!snap.exists()) return;
    const room = snap.val();
    const game = room.game;
    if (!game || !game.result) return;

    const players = room.players || {};
    const location = game.location || LOCATIONS[game.locationIndex] || {};
    const spyUids = game.spyIds ? Object.keys(game.spyIds) : (game.spyId ? [game.spyId] : []);

    const historyEntry = {
      roomCode,
      completedAt: Date.now(),
      startedAt: game.startedAt || null,
      durationMs: game.startedAt ? Date.now() - game.startedAt : null,
      playerCount: Object.keys(players).length,
      location: location.name || 'Unknown',
      locationPack: location.pack || 'unknown',
      result: {
        type: game.result.type,
        winner: game.result.winner,
        accused: game.result.accused || null,
        guessedLocation: game.result.guessedLocation || null,
        correct: game.result.correct ?? null,
        caughtSpies: game.result.caughtSpies || null,
      },
      settings: room.settings || {},
      players: Object.entries(players).reduce((acc, [uid, p]) => {
        acc[uid] = {
          name: p.name,
          wasSpy: spyUids.includes(uid),
          role: game.roles?.[uid] != null ? (location.roles?.[game.roles[uid]] || `Role ${game.roles[uid]}`) : null,
          codename: game.codenames?.[uid] || null,
        };
        return acc;
      }, {}),
      spyIds: spyUids,
      events: game.events ? Object.values(game.events).sort((a, b) => a.ts - b.ts) : [],
      exfiltration: game.exfiltration || null,
    };

    await push(ref(db, 'gameHistory'), historyEntry);
  } catch {
    // Non-critical — don't block game flow
  }
}

/** Log a game event to the timeline (Phase 2.2) */
async function logEvent(type, data = {}) {
  const { roomCode } = getState();
  if (!roomCode) return;
  try {
    const eventsRef = ref(db, `rooms/${roomCode}/game/events`);
    await push(eventsRef, { type, ...data, ts: Date.now() });
  } catch {
    // Non-critical — don't block game flow
  }
}

/** Create a new room and join as host (admin only) */
export async function createRoom(playerName) {
  if (!isCurrentUserAdmin()) {
    throw new Error('Only admins can create rooms. Sign in with Google first.');
  }
  const { uid } = getState();
  let roomCode = generateRoomCode();

  // Check for collision (unlikely but possible)
  let exists = await get(ref(db, `rooms/${roomCode}`));
  let attempts = 0;
  while (exists.val() !== null && attempts < 10) {
    roomCode = generateRoomCode();
    exists = await get(ref(db, `rooms/${roomCode}`));
    attempts++;
  }

  const roomData = {
    host: uid,
    settings: {
      durationSec: 480, // 8 minutes default
      pack: 'all',
      hackerMode: false,
      hackerHintType: 'letter',
      doubleAgent: false,
      incidentMode: false,
    },
    phase: 'lobby',
    players: {
      [uid]: {
        name: playerName,
        connected: true,
        joinedAt: Date.now(),
      },
    },
    game: null,
    customLocations: null,
    createdAt: Date.now(),
  };

  await set(ref(db, `rooms/${roomCode}`), roomData);

  // Set up disconnect handler
  const connRef = ref(db, `rooms/${roomCode}/players/${uid}/connected`);
  onDisconnect(connRef).set(false);

  setState({ roomCode, playerName });
  sessionStorage.setItem('spyfall_room', JSON.stringify({ roomCode }));
  listenToRoom(roomCode);
  navigate('lobby', { roomCode });
}

/** Join an existing room */
export async function joinRoom(roomCode, playerName) {
  const { uid } = getState();
  const roomSnap = await get(ref(db, `rooms/${roomCode}`));

  if (!roomSnap.exists()) {
    throw new Error('Room not found');
  }

  const room = roomSnap.val();
  if (room.phase !== 'lobby') {
    throw new Error('Game already in progress');
  }

  const playerCount = room.players ? Object.keys(room.players).length : 0;
  if (playerCount >= LIMITS.MAX_PLAYERS) {
    throw new Error('Room is full');
  }

  // Add player to room
  await update(ref(db, `rooms/${roomCode}/players/${uid}`), {
    name: playerName,
    connected: true,
    joinedAt: Date.now(),
  });

  // Set up disconnect handler
  const connRef = ref(db, `rooms/${roomCode}/players/${uid}/connected`);
  onDisconnect(connRef).set(false);

  setState({ roomCode, playerName });
  sessionStorage.setItem('spyfall_room', JSON.stringify({ roomCode }));
  listenToRoom(roomCode);
  navigate('lobby', { roomCode });
}

/** Update room settings (host only) */
export async function updateSettings(settings) {
  const { roomCode, room, uid } = getState();
  if (room?.host !== uid) return;
  await update(ref(db, `rooms/${roomCode}/settings`), settings);
}

/** Start the game (host only) */
export async function startGame() {
  const { roomCode, room } = getState();
  const players = room.players;
  const activeUids = Object.entries(players)
    .filter(([, p]) => p.connected !== false)
    .map(([uid]) => uid);

  if (activeUids.length < LIMITS.MIN_PLAYERS) {
    throw new Error(`Need at least ${LIMITS.MIN_PLAYERS} players`);
  }

  const settings = room.settings || {};

  // Double agent requires 5+ players
  if (settings.doubleAgent && activeUids.length < LIMITS.MIN_PLAYERS_DOUBLE_AGENT) {
    throw new Error(`Double Agent mode requires at least ${LIMITS.MIN_PLAYERS_DOUBLE_AGENT} players`);
  }

  // Load custom locations if any
  let customLocations = [];
  if (room.customLocations) {
    customLocations = Object.values(room.customLocations);
  }

  const gameData = buildGameState(activeUids, {
    ...settings,
    customLocations,
  });

  await update(ref(db, `rooms/${roomCode}`), {
    phase: 'playing',
    game: gameData,
  });
}

/** Cast a vote to accuse a player */
export async function castVote(targetUid) {
  const { uid, roomCode, room } = getState();
  if (room?.game?.result?.caughtSpies?.includes(uid)) return; // silently ignore
  await set(ref(db, `rooms/${roomCode}/game/votes/${uid}`), targetUid);
  logEvent('vote', { actor: uid, target: targetUid });
}

let evaluating = false;
let advancing = false;

/** Evaluate votes — called by the listener on the host client when votes change */
export async function evaluateVotes() {
  if (evaluating) return;
  const { uid, roomCode, room } = getState();
  if (room.host !== uid) return; // Only host evaluates
  if (room.game?.result && !room.game.result.partial) return; // Already resolved

  evaluating = true;
  try {

  const votes = room.game?.votes;
  const activePlayers = getActivePlayers();
  const { reached, target } = checkMajority(votes, activePlayers.length);

  if (reached) {
    const game = room.game;
    const isSpy = target === game.spyId || (game.spyIds && game.spyIds[target]);

    // Double agent: first spy caught, continue if more remain
    if (game.spyIds && isSpy) {
      const caughtSpies = game.result?.caughtSpies || [];
      caughtSpies.push(target);
      const allSpyUids = Object.keys(game.spyIds);
      const remainingSpies = allSpyUids.filter((s) => !caughtSpies.includes(s));

      if (remainingSpies.length > 0) {
        // First spy caught — reset votes, continue playing
        await update(ref(db, `rooms/${roomCode}/game`), {
          votes: null,
          result: { caughtSpies, partial: true },
        });
        logEvent('majority', { target, caughtSpies });
        return;
      }
    }

    // Exfiltration mode: wrong accusation boosts spy progress instead of ending
    if (!isSpy && game.exfiltration) {
      const exf = game.exfiltration;
      const voteBoost = exf.voteBoost || 0;
      const newProgress = Math.min(100, exf.progress + voteBoost);
      if (newProgress >= 100) {
        await update(ref(db, `rooms/${roomCode}/game`), {
          exfiltration: { ...exf, progress: 100 },
          votes: null,
          result: {
            type: 'exfiltration',
            winner: 'spy',
            resolvedAtMs: Date.now(),
          },
        });
        await set(ref(db, `rooms/${roomCode}/phase`), 'results');
        persistGameHistory(roomCode);
      } else {
        await update(ref(db, `rooms/${roomCode}/game`), {
          exfiltration: { ...exf, progress: newProgress },
          votes: null,
        });
      }
      logEvent('majority', { target, wrongAccusation: true });
      return;
    }

    // Game ends
    await update(ref(db, `rooms/${roomCode}/game`), {
      result: {
        type: 'vote',
        accused: target,
        isSpy,
        winner: isSpy ? 'players' : 'spy',
        caughtSpies: game.spyIds ? [...(game.result?.caughtSpies || []), target] : undefined,
        resolvedAtMs: Date.now(),
      },
    });
    await set(ref(db, `rooms/${roomCode}/phase`), 'results');
    persistGameHistory(roomCode);
    logEvent('majority', { target });
  }

  } finally {
    evaluating = false;
  }
}

/** Spy guesses the location */
export async function spyGuessLocation(locationIndex, locationName = null) {
  const { uid, roomCode, room } = getState();
  const game = room.game;

  const isSpyAllowed = uid === game.spyId || (game.spyIds && game.spyIds[uid]);
  if (!isSpyAllowed) {
    throw new Error('Only the spy can guess');
  }

  // Check if this spy was already caught in double agent mode
  if (game.result?.caughtSpies?.includes(uid)) {
    throw new Error('You have already been caught');
  }

  // Support both index-based and name-based guessing (for custom locations)
  let correct;
  let guessedName;
  if (locationName !== null) {
    // Name-based comparison (custom locations)
    guessedName = locationName;
    correct = game.location?.name === locationName;
  } else {
    guessedName = LOCATIONS[locationIndex]?.name || 'Unknown';
    correct = locationIndex === game.locationIndex;
  }

  await update(ref(db, `rooms/${roomCode}/game`), {
    spyGuess: locationIndex ?? locationName,
    result: {
      type: 'guess',
      guessedLocation: guessedName,
      correct,
      winner: correct ? 'spy' : 'players',
      resolvedAtMs: Date.now(),
    },
  });
  await set(ref(db, `rooms/${roomCode}/phase`), 'results');
  persistGameHistory(roomCode);
  logEvent('spy_guess', { actor: uid, guessedLocation: guessedName });
}

/** Handle timer expiry (host only) */
export async function handleTimerExpiry() {
  const { roomCode, room, uid } = getState();
  if (room.host !== uid) return; // Only host writes
  if (room.game?.result && !room.game.result.partial) return; // Already ended

  await update(ref(db, `rooms/${roomCode}/game`), {
    result: {
      type: 'timeout',
      winner: 'spy',
      resolvedAtMs: Date.now(),
    },
  });
  await set(ref(db, `rooms/${roomCode}/phase`), 'results');
  persistGameHistory(roomCode);
  logEvent('timeout', {});
}

/** Advance round in incident response mode (host only) */
export async function advanceRound() {
  if (advancing) return;
  const { roomCode, room, uid } = getState();
  if (room.host !== uid) return;
  if (room.game?.result && !room.game.result.partial) return;

  const exf = room.game.exfiltration;
  if (!exf) return;

  advancing = true;
  try {
    const newProgress = Math.min(100, exf.progress + exf.incrementPerRound);
    const newRound = exf.roundNumber + 1;

    if (newProgress >= 100) {
      // Spy wins via exfiltration
      await update(ref(db, `rooms/${roomCode}/game`), {
        exfiltration: { ...exf, progress: 100, roundNumber: newRound },
        result: {
          type: 'exfiltration',
          winner: 'spy',
          resolvedAtMs: Date.now(),
        },
      });
      await set(ref(db, `rooms/${roomCode}/phase`), 'results');
      persistGameHistory(roomCode);
    } else {
      await update(ref(db, `rooms/${roomCode}/game/exfiltration`), {
        progress: newProgress,
        roundNumber: newRound,
      });
    }
  } finally {
    advancing = false;
  }
}

/** Add a custom location (host only) */
export async function addCustomLocation(locationData) {
  const { roomCode, room, uid } = getState();
  if (room?.host !== uid) return;
  const customRef = ref(db, `rooms/${roomCode}/customLocations`);
  await push(customRef, {
    name: locationData.name,
    pack: 'custom',
    roles: locationData.roles,
  });
}

/** Remove a custom location (host only) */
export async function removeCustomLocation(locationKey) {
  const { roomCode, room, uid } = getState();
  if (room?.host !== uid) return;
  await set(ref(db, `rooms/${roomCode}/customLocations/${locationKey}`), null);
}

/** Play again — reset to lobby */
export async function playAgain() {
  const { roomCode, uid, room } = getState();
  if (room.host !== uid) return;

  await update(ref(db, `rooms/${roomCode}`), {
    phase: 'lobby',
    game: null,
  });
}

/** Leave the room */
export async function leaveRoom() {
  const { uid, roomCode } = getState();
  if (!roomCode) return;

  await set(ref(db, `rooms/${roomCode}/players/${uid}/connected`), false);
  stopListening();
  sessionStorage.removeItem('spyfall_room');
  setState({ roomCode: null, room: null });
  navigate('home');
}
