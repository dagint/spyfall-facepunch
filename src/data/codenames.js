import { shuffle } from '../utils/shuffle.js';

export const NATO = [
  'ALPHA', 'BRAVO', 'CHARLIE', 'DELTA',
  'ECHO', 'FOXTROT', 'GOLF', 'HOTEL',
  'INDIA', 'JULIET', 'KILO', 'LIMA',
];

export const HACKER_ALIASES = [
  'PHANTOM', 'CIPHER', 'GHOST', 'SHADOW',
  'VECTOR', 'BINARY', 'KERNEL', 'DAEMON',
  'EXPLOIT', 'ROOTKIT', 'PAYLOAD', 'BEACON',
];

/**
 * Assign codenames to player UIDs.
 * @param {string[]} playerUids
 * @param {'nato'|'hacker'} style
 * @returns {Object<string, string>} uid → codename
 */
export function assignCodenames(playerUids, style = 'nato') {
  const pool = style === 'hacker' ? [...HACKER_ALIASES] : [...NATO];
  const shuffled = shuffle(pool);

  const codenames = {};
  playerUids.forEach((uid, i) => {
    codenames[uid] = shuffled[i % shuffled.length];
  });
  return codenames;
}
