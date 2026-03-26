/**
 * Local reactive game state.
 * Components subscribe to re-render when state changes.
 */

let state = {
  uid: null,
  playerName: '',
  roomCode: null,
  room: null, // Full room object from Firebase
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(partial) {
  state = { ...state, ...partial };
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Convenience getters
export function isHost() {
  return state.room?.host === state.uid;
}

export function getMyPlayer() {
  return state.room?.players?.[state.uid] ?? null;
}

export function getPlayers() {
  const players = state.room?.players;
  if (!players) return [];
  return Object.entries(players).map(([uid, data]) => ({
    uid,
    ...data,
  }));
}

export function getActivePlayers() {
  return getPlayers().filter((p) => p.connected !== false);
}

export function getGameData() {
  return state.room?.game ?? null;
}
