import {
  db,
  ref,
  set,
  get,
  update,
  onDisconnect,
  push,
  isCurrentUserAdmin,
  getCurrentEmail,
} from '../firebase.js';
import { getState, setState, getActivePlayers } from './state.js';
import { generateRoomCode } from '../utils/roomCode.js';
import { buildGameState, checkMajority } from './engine.js';
import { LOCATIONS } from '../data/locations.js';
import { navigate } from '../router.js';
import { listenToRoom, stopListening } from './listeners.js';
import { LIMITS, STORAGE_KEYS, PHASE, EVENT_TYPE, RESULT_TYPE } from '../constants.js';
import { isSpy as checkIsSpy, getSpyUids } from '../utils/gameHelpers.js';

/**
 * Build the full reveal object included in every game result.
 * This lets the results screen display spy identity, location, and roles
 * without needing access to roomSecrets.
 */
function buildRevealData(roomSecrets) {
  if (!roomSecrets) return {};
  return {
    spyId: roomSecrets.spyId,
    spyIds: roomSecrets.spyIds || null,
    location: roomSecrets.location,
    locationIndex: roomSecrets.locationIndex,
    roles: roomSecrets.roles,
  };
}

/**
 * Finalize a game: write result, transition to RESULTS phase, and persist history.
 * Uses a single atomic multi-path update for consistency.
 */
async function finalizeGame(roomCode, resultPayload, extraGameUpdates = {}) {
  const gameUpdates = { ...extraGameUpdates, result: resultPayload };
  const updates = {
    [`rooms/${roomCode}/phase`]: PHASE.RESULTS,
  };
  for (const [key, value] of Object.entries(gameUpdates)) {
    updates[`rooms/${roomCode}/game/${key}`] = value;
  }
  await update(ref(db), updates);
  persistGameHistory(roomCode);
}

/** Persist detailed game history for dashboard analytics (reads from local state) */
async function persistGameHistory(roomCode) {
  try {
    const { room } = getState();
    if (!room) return;
    if (!room.hostedByAdmin) return; // Only persist admin-hosted games
    const game = room.game;
    if (!game || !game.result) return;

    const players = room.players || {};
    const result = game.result;
    const location = result.location || {};
    const spyUids = getSpyUids(result);

    const historyEntry = {
      roomCode,
      hostedByEmail: getCurrentEmail() || 'unknown',
      completedAt: Date.now(),
      startedAt: game.startedAt || null,
      durationMs: game.startedAt ? Date.now() - game.startedAt : null,
      playerCount: Object.keys(players).length,
      location: location.name || 'Unknown',
      locationPack: location.pack || 'unknown',
      result: {
        type: result.type,
        winner: result.winner,
        accused: result.accused || null,
        guessedLocation: result.guessedLocation || null,
        correct: result.correct ?? null,
        caughtSpies: result.caughtSpies || null,
      },
      settings: room.settings || {},
      players: Object.entries(players).reduce((acc, [uid, p]) => {
        acc[uid] = {
          name: p.name,
          wasSpy: spyUids.includes(uid),
          role: result.roles?.[uid] != null ? (location.roles?.[result.roles[uid]] || `Role ${result.roles[uid]}`) : null,
          codename: game.codenames?.[uid] || null,
        };
        return acc;
      }, {}),
      spyIds: spyUids,
      events: game.events ? Object.values(game.events).sort((a, b) => a.ts - b.ts) : [],
      exfiltration: game.exfiltration || null,
    };

    await push(ref(db, 'gameHistory'), historyEntry);
  } catch (err) {
    console.warn('Failed to persist game history:', err);
  }
}

/** Log a game event to the timeline */
async function logEvent(type, data = {}) {
  const { roomCode } = getState();
  if (!roomCode) return;
  try {
    const eventsRef = ref(db, `rooms/${roomCode}/game/events`);
    await push(eventsRef, { type, ...data, ts: Date.now() });
  } catch (err) {
    console.warn('Failed to log event:', err);
  }
}

/** Create a new room and join as host (anyone) */
export async function createRoom(playerName) {
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
    hostedByAdmin: isCurrentUserAdmin() ? true : null,
    settings: {
      durationSec: 480,
      pack: 'all',
      hackerMode: false,
      hackerHintType: 'letter',
      doubleAgent: false,
      incidentMode: false,
    },
    phase: PHASE.LOBBY,
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

  const connRef = ref(db, `rooms/${roomCode}/players/${uid}/connected`);
  onDisconnect(connRef).set(false);

  setState({ roomCode, playerName });
  sessionStorage.setItem(STORAGE_KEYS.ROOM, JSON.stringify({ roomCode }));
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
  if (room.phase !== PHASE.LOBBY) {
    throw new Error('Game already in progress');
  }

  const playerCount = room.players ? Object.keys(room.players).length : 0;
  if (playerCount >= LIMITS.MAX_PLAYERS) {
    throw new Error('Room is full');
  }

  await update(ref(db, `rooms/${roomCode}/players/${uid}`), {
    name: playerName,
    connected: true,
    joinedAt: Date.now(),
  });

  const connRef = ref(db, `rooms/${roomCode}/players/${uid}/connected`);
  onDisconnect(connRef).set(false);

  setState({ roomCode, playerName });
  sessionStorage.setItem(STORAGE_KEYS.ROOM, JSON.stringify({ roomCode }));
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
  const { uid, roomCode, room } = getState();
  if (room.host !== uid) throw new Error('Only the host can start the game');
  const players = room.players;
  const activeUids = Object.entries(players)
    .filter(([, p]) => p.connected !== false)
    .map(([uid]) => uid);

  if (activeUids.length < LIMITS.MIN_PLAYERS) {
    throw new Error(`Need at least ${LIMITS.MIN_PLAYERS} players`);
  }

  const settings = room.settings || {};

  if (settings.doubleAgent && activeUids.length < LIMITS.MIN_PLAYERS_DOUBLE_AGENT) {
    throw new Error(`Double Agent mode requires at least ${LIMITS.MIN_PLAYERS_DOUBLE_AGENT} players`);
  }

  let customLocations = [];
  if (room.customLocations) {
    customLocations = Object.values(room.customLocations);
  }

  const { publicGame, secrets, playerRoles } = buildGameState(activeUids, {
    ...settings,
    customLocations,
  });

  // Atomic multi-path write: public game + secrets + per-player roles
  const updates = {
    [`rooms/${roomCode}/phase`]: PHASE.PLAYING,
    [`rooms/${roomCode}/game`]: publicGame,
    [`roomSecrets/${roomCode}`]: secrets,
  };
  Object.entries(playerRoles).forEach(([playerUid, roleData]) => {
    updates[`playerRoles/${roomCode}/${playerUid}`] = roleData;
  });

  await update(ref(db), updates);
}

/** Cast a vote to accuse a player */
export async function castVote(targetUid) {
  const { uid, roomCode, room } = getState();
  if (room?.game?.result?.caughtSpies?.includes(uid)) return;
  await set(ref(db, `rooms/${roomCode}/game/votes/${uid}`), targetUid);
  logEvent(EVENT_TYPE.VOTE, { actor: uid, target: targetUid });
}

let evaluating = false;

/** Evaluate votes — called by the listener on the host client when votes change */
export async function evaluateVotes() {
  if (evaluating) return;
  const { uid, roomCode, room, roomSecrets } = getState();
  if (room.host !== uid) return;
  if (room.game?.result && !room.game.result.partial) return;
  if (!roomSecrets) return; // Secrets not loaded yet

  evaluating = true;
  try {
    const votes = room.game?.votes;
    const activePlayers = getActivePlayers();
    const { reached, target } = checkMajority(votes, activePlayers.length);

    if (reached) {
      const game = room.game;
      const targetIsSpy = checkIsSpy(target, roomSecrets);
      const reveal = buildRevealData(roomSecrets);

      // Double agent: first spy caught, continue if more remain
      if (roomSecrets.spyIds && targetIsSpy) {
        const caughtSpies = [...(game.result?.caughtSpies || []), target];
        const allSpyUids = Object.keys(roomSecrets.spyIds);
        const remainingSpies = allSpyUids.filter((s) => !caughtSpies.includes(s));

        if (remainingSpies.length > 0) {
          await update(ref(db, `rooms/${roomCode}/game`), {
            votes: null,
            result: { caughtSpies, partial: true },
          });
          logEvent(EVENT_TYPE.MAJORITY, { target, caughtSpies });
          return;
        }
      }

      // Exfiltration mode: wrong accusation boosts spy progress instead of ending
      if (!targetIsSpy && game.exfiltration) {
        const exf = game.exfiltration;
        const voteBoost = exf.voteBoost || 0;
        const newProgress = Math.min(100, exf.progress + voteBoost);
        if (newProgress >= 100) {
          await finalizeGame(roomCode, {
            type: RESULT_TYPE.EXFILTRATION,
            winner: 'spy',
            resolvedAtMs: Date.now(),
            ...reveal,
          }, { exfiltration: { ...exf, progress: 100 }, votes: null });
        } else {
          await update(ref(db, `rooms/${roomCode}/game`), {
            exfiltration: { ...exf, progress: newProgress },
            votes: null,
          });
        }
        logEvent(EVENT_TYPE.MAJORITY, { target, wrongAccusation: true });
        return;
      }

      // Game ends
      await finalizeGame(roomCode, {
        type: RESULT_TYPE.VOTE,
        accused: target,
        isSpy: targetIsSpy,
        winner: targetIsSpy ? 'players' : 'spy',
        caughtSpies: roomSecrets.spyIds ? [...(game.result?.caughtSpies || []), target] : undefined,
        resolvedAtMs: Date.now(),
        ...reveal,
      });
      logEvent(EVENT_TYPE.MAJORITY, { target });
    }
  } finally {
    evaluating = false;
  }
}

/** Spy writes their guess — host evaluates correctness via evaluateSpyGuess() */
export async function spyGuessLocation(locationIndex, locationName = null) {
  const { uid, roomCode, myRole, room } = getState();

  if (!myRole?.isSpy) {
    throw new Error('Only the spy can guess');
  }

  const game = room?.game;
  if (game?.result?.caughtSpies?.includes(uid)) {
    throw new Error('You have already been caught');
  }

  // Write the guess — the host will evaluate correctness
  const guessValue = locationName !== null ? `name:${locationName}` : `idx:${locationIndex}`;
  await set(ref(db, `rooms/${roomCode}/game/spyGuess`), guessValue);
  logEvent(EVENT_TYPE.SPY_GUESS, { actor: uid, guessedLocation: locationName || (LOCATIONS[locationIndex]?.name || 'Unknown') });
}

/** Host evaluates a spy's location guess (called by listener when spyGuess changes) */
export async function evaluateSpyGuess() {
  const { uid, roomCode, room, roomSecrets } = getState();
  if (room.host !== uid) return;
  if (!roomSecrets) return;
  if (room.game?.result && !room.game.result.partial) return;

  const guessValue = room.game?.spyGuess;
  if (guessValue == null) return;

  let correct;
  let guessedName;

  if (typeof guessValue === 'string' && guessValue.startsWith('name:')) {
    // Name-based guess (custom location)
    guessedName = guessValue.slice(5);
    correct = roomSecrets.location?.name === guessedName;
  } else if (typeof guessValue === 'string' && guessValue.startsWith('idx:')) {
    // Index-based guess
    const locationIndex = parseInt(guessValue.slice(4));
    guessedName = LOCATIONS[locationIndex]?.name || 'Unknown';
    correct = locationIndex >= 0 && locationIndex === roomSecrets.locationIndex;
  } else {
    // Legacy format fallback
    return;
  }

  const reveal = buildRevealData(roomSecrets);

  await finalizeGame(roomCode, {
    type: RESULT_TYPE.GUESS,
    guessedLocation: guessedName,
    correct,
    winner: correct ? 'spy' : 'players',
    resolvedAtMs: Date.now(),
    ...reveal,
  });
  logEvent(EVENT_TYPE.SPY_GUESS, { guessedLocation: guessedName, correct });
}

/** Handle timer expiry (host only) */
export async function handleTimerExpiry() {
  const { roomCode, room, uid, roomSecrets } = getState();
  if (room.host !== uid) return;
  if (room.game?.result && !room.game.result.partial) return;

  const reveal = buildRevealData(roomSecrets);

  await finalizeGame(roomCode, {
    type: RESULT_TYPE.TIMEOUT,
    winner: 'spy',
    resolvedAtMs: Date.now(),
    ...reveal,
  });
  logEvent(EVENT_TYPE.TIMEOUT, {});
}

let advancing = false;

/** Advance round in incident response mode (host only) */
export async function advanceRound() {
  if (advancing) return;
  const { roomCode, room, uid, roomSecrets } = getState();
  if (room.host !== uid) return;
  if (room.game?.result && !room.game.result.partial) return;

  const exf = room.game.exfiltration;
  if (!exf) return;

  advancing = true;
  try {
    const newProgress = Math.min(100, exf.progress + exf.incrementPerRound);
    const newRound = exf.roundNumber + 1;

    if (newProgress >= 100) {
      const reveal = buildRevealData(roomSecrets);
      await finalizeGame(roomCode, {
        type: RESULT_TYPE.EXFILTRATION,
        winner: 'spy',
        resolvedAtMs: Date.now(),
        ...reveal,
      }, { exfiltration: { ...exf, progress: 100, roundNumber: newRound } });
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

/** Play again — reset to lobby, clear secrets */
export async function playAgain() {
  const { roomCode, uid, room } = getState();
  if (room.host !== uid) return;

  // Atomic clear of game data + secrets + player roles
  const updates = {
    [`rooms/${roomCode}/phase`]: PHASE.LOBBY,
    [`rooms/${roomCode}/game`]: null,
    [`roomSecrets/${roomCode}`]: null,
    [`playerRoles/${roomCode}`]: null,
  };
  await update(ref(db), updates);
}

/** Leave the room */
export async function leaveRoom() {
  const { uid, roomCode } = getState();
  if (!roomCode) return;

  await set(ref(db, `rooms/${roomCode}/players/${uid}/connected`), false);
  stopListening();
  sessionStorage.removeItem(STORAGE_KEYS.ROOM);
  setState({ roomCode: null, room: null, myRole: null, roomSecrets: null });
  navigate('home');
}
