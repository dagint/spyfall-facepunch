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

  // Shuffle the pool
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const codenames = {};
  playerUids.forEach((uid, i) => {
    codenames[uid] = pool[i % pool.length];
  });
  return codenames;
}
