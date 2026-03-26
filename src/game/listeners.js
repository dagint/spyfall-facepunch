import { db, ref, onValue } from '../firebase.js';
import { setState, getState } from './state.js';
import { navigate } from '../router.js';
import { evaluateVotes } from './actions.js';
import { play } from '../audio/sounds.js';

let unsubscribe = null;

/** Start listening to a room's state in Firebase */
export function listenToRoom(roomCode) {
  // Clean up previous listener
  stopListening();

  const roomRef = ref(db, `rooms/${roomCode}`);

  unsubscribe = onValue(roomRef, (snapshot) => {
    const room = snapshot.val();
    if (!room) {
      // Room was deleted
      setState({ room: null, roomCode: null });
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
        case 'lobby':
          navigate('lobby');
          break;
        case 'playing':
          play('game-start');
          navigate('game');
          break;
        case 'results':
          navigate('results');
          break;
      }
    }

    // Host evaluates votes when they change
    if (newPhase === 'playing' && room.game?.votes && (!room.game?.result || room.game?.result?.partial)) {
      const prevVoteCount = prevRoom?.game?.votes
        ? Object.keys(prevRoom.game.votes).length
        : 0;
      const newVoteCount = Object.keys(room.game.votes).length;
      if (newVoteCount > prevVoteCount) {
        evaluateVotes();
      }
    }
  });
}

/** Stop listening to room updates */
export function stopListening() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
