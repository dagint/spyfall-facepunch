import { LOCATIONS, LOCATION_PACKS } from '../data/locations.js';
import { assignCodenames } from '../data/codenames.js';
import { shuffle } from '../utils/shuffle.js';
import { LIMITS } from '../constants.js';

/**
 * Pick a random location based on the selected pack.
 * @param {'classic'|'tech'|'all'} pack
 * @param {object[]} [customLocations] - optional custom locations to include
 * @returns {object} { index, location } — index is into LOCATIONS (or -1 for custom), location is the object
 */
export function pickLocation(pack = 'all', customLocations = []) {
  const eligible = LOCATIONS
    .map((loc, i) => ({ loc, i }))
    .filter(({ loc }) => {
      if (pack === 'all') return true;
      return loc.pack === pack;
    });

  // Add custom locations with index -1 (they are referenced by name)
  const customEligible = customLocations.map((loc) => ({ loc, i: -1 }));
  const pool = [...eligible, ...customEligible];

  const pick = pool[Math.floor(Math.random() * pool.length)];
  return { index: pick.i, location: pick.loc };
}

/**
 * Choose the spy from active player UIDs.
 * @param {string[]} playerUids
 * @returns {string} spy UID
 */
export function pickSpy(playerUids) {
  return playerUids[Math.floor(Math.random() * playerUids.length)];
}

/**
 * Pick multiple spies for double agent mode.
 * @param {string[]} playerUids
 * @param {number} count
 * @returns {string[]}
 */
export function pickSpies(playerUids, count = 2) {
  const shuffled = shuffle([...playerUids]);
  return shuffled.slice(0, count);
}

/**
 * Assign roles to non-spy players.
 * @param {string[]} playerUids - all player UIDs
 * @param {string|string[]} spyUids - single spy UID or array of spy UIDs
 * @returns {Object<string, number>} uid → role index (0-7)
 */
export function assignRoles(playerUids, spyUids) {
  const spySet = new Set(Array.isArray(spyUids) ? spyUids : [spyUids]);
  const nonSpy = playerUids.filter((uid) => !spySet.has(uid));

  // Shuffle role indices and assign
  const roleIndices = shuffle(Array.from({ length: LIMITS.ROLES_PER_LOCATION }, (_, i) => i));
  const assignments = {};

  nonSpy.forEach((uid, i) => {
    assignments[uid] = roleIndices[i % LIMITS.ROLES_PER_LOCATION];
  });

  // Spies get no role (null)
  spySet.forEach((uid) => {
    assignments[uid] = null;
  });

  return assignments;
}

/**
 * Generate a spy hint based on the location.
 * @param {object} location - location object with name and pack
 * @param {'letter'|'category'} hintType
 * @returns {string}
 */
export function generateSpyHint(location, hintType) {
  if (hintType === 'letter') {
    return `First letter: "${location.name[0].toUpperCase()}"`;
  }
  if (hintType === 'category') {
    const packLabel = LOCATION_PACKS[location.pack] || location.pack;
    return `Category: ${packLabel}`;
  }
  return '';
}

/**
 * Build the full game object to write to Firebase.
 */
export function buildGameState(playerUids, settings) {
  const { pack, durationSec, hackerMode, hackerHintType, doubleAgent, incidentMode, customLocations } = settings;

  const { index: locationIndex, location } = pickLocation(pack, customLocations || []);

  // Determine spies
  let spyUid, spyUids;
  if (doubleAgent && playerUids.length >= 5) {
    const spyArr = pickSpies(playerUids, 2);
    spyUid = spyArr[0]; // Keep for compat
    spyUids = {};
    spyArr.forEach((uid) => { spyUids[uid] = true; });
  } else {
    spyUid = pickSpy(playerUids);
    spyUids = null;
  }

  const roles = assignRoles(playerUids, spyUids ? Object.keys(spyUids) : spyUid);

  // Codenames
  const codenameStyle = pack === 'tech' ? 'hacker' : 'nato';
  const codenames = assignCodenames(playerUids, codenameStyle);

  // Spy hint
  let spyHint = null;
  if (hackerMode) {
    spyHint = generateSpyHint(location, hackerHintType || 'letter');
  }

  // Exfiltration state for incident mode
  let exfiltration = null;
  if (incidentMode) {
    exfiltration = buildExfiltrationState(playerUids.length);
  }

  // Public game data (readable by all room members)
  const publicGame = {
    codenames,
    durationSec: incidentMode ? null : durationSec,
    startedAt: Date.now(),
    votes: null,
    accusation: null,
    spyGuess: null,
    exfiltration,
    result: null,
  };

  // Secrets (readable only by host, used for vote evaluation)
  const secrets = {
    spyId: spyUid,
    spyIds: spyUids,
    location: { name: location.name, pack: location.pack, roles: location.roles },
    locationIndex,
    roles,
  };

  // Per-player role data (each player can only read their own)
  const playerRolesMap = {};
  playerUids.forEach((uid) => {
    const isPlayerSpy = spyUids ? !!spyUids[uid] : uid === spyUid;
    playerRolesMap[uid] = {
      isSpy: isPlayerSpy,
      location: isPlayerSpy ? null : { name: location.name, pack: location.pack },
      role: isPlayerSpy ? null : (location.roles[roles[uid]] || null),
      roleIndex: roles[uid] ?? null,
      spyHint: isPlayerSpy ? spyHint : null,
    };
  });

  return { publicGame, secrets, playerRoles: playerRolesMap };
}

/**
 * Build initial exfiltration state for incident response mode.
 */
export function buildExfiltrationState(playerCount) {
  // More players = slower exfiltration
  const incrementPerRound = Math.max(8, Math.floor(60 / playerCount));
  return {
    progress: 0,
    roundNumber: 0,
    incrementPerRound,
    voteBoost: 15, // wrong accusation adds this much
  };
}

/**
 * Check if a majority vote is reached.
 * @param {Object} votes - uid → targetUid
 * @param {number} totalPlayers
 * @returns {{ reached: boolean, target: string|null, count: number }}
 */
export function checkMajority(votes, totalPlayers) {
  if (!votes) return { reached: false, target: null, count: 0 };

  const counts = {};
  Object.values(votes).forEach((target) => {
    counts[target] = (counts[target] || 0) + 1;
  });

  const majority = Math.ceil(totalPlayers / 2);
  for (const [target, count] of Object.entries(counts)) {
    if (count >= majority) {
      return { reached: true, target, count };
    }
  }

  return { reached: false, target: null, count: 0 };
}

