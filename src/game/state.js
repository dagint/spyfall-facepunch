/**
 * Local reactive game state.
 * Components subscribe to re-render when state changes.
 */

let state = {
  uid: null,
  playerName: '',
  roomCode: null,
  room: null, // Full room object from Firebase
  myRole: null, // Per-player secret: { isSpy, location, role, roleIndex, spyHint }
  roomSecrets: null, // Host-only: { spyId, spyIds, location, locationIndex, roles }
};

const listeners = new Set();

/**
 * Get the current application state.
 * @returns {{ uid: string|null, playerName: string, roomCode: string|null, room: object|null }}
 */
export function getState() {
  return state;
}

/**
 * Merge partial updates into the current state and notify all subscribers.
 * @param {Partial<{ uid: string|null, playerName: string, roomCode: string|null, room: object|null }>} partial
 * @returns {void}
 */
export function setState(partial) {
  state = { ...state, ...partial };
  listeners.forEach((fn) => fn(state));
}

/**
 * Subscribe to state changes. Returns an unsubscribe function.
 * @param {function} fn - callback invoked with the new state on each change
 * @returns {function} unsubscribe function
 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Convenience getters

/**
 * Check whether the current user is the room host.
 * @returns {boolean}
 */
export function isHost() {
  return state.room?.host === state.uid;
}

/**
 * Get the current user's player data from the room.
 * @returns {object|null} player data or null if not in a room
 */
export function getMyPlayer() {
  return state.room?.players?.[state.uid] ?? null;
}

/**
 * Get all players in the room as an array of { uid, ...playerData }.
 * @returns {Array<{ uid: string, name: string, connected: boolean, joinedAt: number }>}
 */
export function getPlayers() {
  const players = state.room?.players;
  if (!players) return [];
  return Object.entries(players).map(([uid, data]) => ({
    uid,
    ...data,
  }));
}

/**
 * Get only connected (active) players in the room.
 * @returns {Array<{ uid: string, name: string, connected: boolean, joinedAt: number }>}
 */
export function getActivePlayers() {
  return getPlayers().filter((p) => p.connected !== false);
}

/**
 * Get the current game data from the room state.
 * @returns {object|null} game data or null if no game is active
 */
export function getGameData() {
  return state.room?.game ?? null;
}
