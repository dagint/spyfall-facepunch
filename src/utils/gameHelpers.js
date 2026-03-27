import { LOCATIONS } from '../data/locations.js';

/**
 * Check if a player is the spy in a game.
 * Works with any object that has spyId/spyIds (game, roomSecrets, result).
 * @param {string} uid - player UID to check
 * @param {object} data - object with spyId and/or spyIds fields
 * @returns {boolean}
 */
export function isSpy(uid, data) {
  if (!uid || !data) return false;
  return uid === data.spyId || !!(data.spyIds && data.spyIds[uid]);
}

/**
 * Get all spy UIDs from an object with spyId/spyIds fields.
 * @param {object} data - object with spyId and/or spyIds fields
 * @returns {string[]}
 */
export function getSpyUids(data) {
  if (!data) return [];
  if (data.spyIds) return Object.keys(data.spyIds);
  return data.spyId ? [data.spyId] : [];
}

/**
 * Get all locations filtered by pack, including custom locations.
 * @param {string} pack - pack ID or 'all'
 * @param {object} [customLocations] - custom locations object from Firebase
 * @returns {object[]} array of location objects
 */
export function getFilteredLocations(pack, customLocations = null) {
  let locs = LOCATIONS.filter((loc) => {
    if (pack === 'all') return true;
    return loc.pack === pack;
  });

  if (customLocations) {
    const customs = Object.values(customLocations);
    locs = [...locs, ...customs];
  }

  return locs;
}
