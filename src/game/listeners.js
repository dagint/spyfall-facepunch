import { db, ref, onValue } from '../firebase.js';
import { setState, getState } from './state.js';
import { navigate } from '../router.js';
import { evaluateVotes, evaluateSpyGuess } from './actions.js';
import { play } from '../audio/sounds.js';
import { PHASE } from '../constants.js';

let unsubscribe = null;
let roleUnsub = null;
let secretsUnsub = null;

/** Start listening to a room's state in Firebase */
export function listenToRoom(roomCode) {
  // Clean up previous listeners
  stopListening();

  const roomRef = ref(db, `rooms/${roomCode}`);

  unsubscribe = onValue(roomRef, (snapshot) => {
    const room = snapshot.val();
    if (!room) {
      // Room was deleted
      setState({ room: null, roomCode: null, myRole: null, roomSecrets: null });
      navigate('home');
      return;
    }

    const prevRoom = getState().room;
    setState({ room });

    // Auto-navigate based on phase changes
    const prevPhase = prevRoom?.phase;
    const newPhase = room.phase;

    if (prevPhase !== newPhase) {
      switch (newPhase) {
        case PHASE.LOBBY:
          // Clean up game-specific listeners when returning to lobby
          stopGameListeners();
          navigate('lobby');
          break;
        case PHASE.PLAYING:
          // Start per-player role listener and host secrets listener
          startGameListeners(roomCode);
          play('game-start');
          navigate('game');
          break;
        case PHASE.RESULTS:
          navigate('results');
          break;
      }
    }

    // Host evaluates votes when they change (compare content, not just count)
    const isRoomHost = room.host === getState().uid;
    if (isRoomHost && newPhase === PHASE.PLAYING && room.game?.votes && (!room.game?.result || room.game?.result?.partial)) {
      const prevVotes = prevRoom?.game?.votes;
      const newVotes = room.game.votes;
      const prevKey = prevVotes ? JSON.stringify(prevVotes) : '';
      const newKey = JSON.stringify(newVotes);
      if (newKey !== prevKey) {
        evaluateVotes();
      }
    }

    // Host evaluates spy guess when it changes
    if (isRoomHost && newPhase === PHASE.PLAYING && room.game?.spyGuess != null) {
      const prevGuess = prevRoom?.game?.spyGuess;
      if (prevGuess !== room.game.spyGuess) {
        evaluateSpyGuess();
      }
    }
  });
}

/** Start game-specific listeners (playerRoles + host secrets) */
function startGameListeners(roomCode) {
  const { uid } = getState();

  // Listen to own role data
  if (!roleUnsub) {
    const roleRef = ref(db, `playerRoles/${roomCode}/${uid}`);
    roleUnsub = onValue(roleRef, (snap) => {
      setState({ myRole: snap.val() });
    });
  }

  // Host also listens to secrets (for vote/guess evaluation)
  const room = getState().room;
  if (!secretsUnsub && room?.host === uid) {
    const secretsRef = ref(db, `roomSecrets/${roomCode}`);
    secretsUnsub = onValue(secretsRef, (snap) => {
      setState({ roomSecrets: snap.val() });
    });
  }
}

/** Stop game-specific listeners */
function stopGameListeners() {
  if (roleUnsub) { roleUnsub(); roleUnsub = null; }
  if (secretsUnsub) { secretsUnsub(); secretsUnsub = null; }
  setState({ myRole: null, roomSecrets: null });
}

/** Stop all listeners */
export function stopListening() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  stopGameListeners();
}
