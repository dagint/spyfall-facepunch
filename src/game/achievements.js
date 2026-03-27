import { ACHIEVEMENTS } from '../data/achievements.js';
import { isSpy } from '../utils/gameHelpers.js';
import { ACHIEVEMENT_THRESHOLDS, STORAGE_KEYS, RESULT_TYPE } from '../constants.js';

function getKey(uid) {
  return `${STORAGE_KEYS.ACHIEVEMENTS_PREFIX}${uid}`;
}

export function loadAchievements(uid) {
  try {
    const raw = localStorage.getItem(getKey(uid));
    return raw ? JSON.parse(raw) : { unlocked: [], stats: defaultStats() };
  } catch (err) {
    console.warn('Failed to load achievements:', err);
    return { unlocked: [], stats: defaultStats() };
  }
}

export function saveAchievements(uid, data) {
  localStorage.setItem(getKey(uid), JSON.stringify(data));
}

function defaultStats() {
  return {
    gamesPlayed: 0,
    spyWins: 0,
    playerWins: 0,
    spyGuessWins: 0,
    spyCatches: 0,
    firstVoteCatch: 0,
    fastSpyGuess: 0,
    timeoutWins: 0,
  };
}

/**
 * Process a game result and return newly unlocked achievements.
 * @param {string} uid - current player UID
 * @param {object} gameData - the game object from Firebase
 * @param {object} result - game.result
 * @returns {object[]} newly unlocked achievement definitions
 */
export function processGameResult(uid, gameData, result) {
  const data = loadAchievements(uid);
  const stats = data.stats || defaultStats();
  // result contains spyId/spyIds from buildRevealData — gameData (public) does not
  const wasSpy = isSpy(uid, result);

  // Update stats
  stats.gamesPlayed++;

  if (wasSpy && result.winner === 'spy') {
    stats.spyWins++;
  }
  if (!wasSpy && result.winner === 'players') {
    stats.playerWins++;
  }

  // Spy guess win
  if (wasSpy && result.type === RESULT_TYPE.GUESS && result.correct) {
    stats.spyGuessWins++;
    // Fast spy guess (under 60s)
    if (gameData.startedAt) {
      const elapsed = (result.resolvedAtMs || Date.now()) - gameData.startedAt;
      if (elapsed < ACHIEVEMENT_THRESHOLDS.FAST_SPY_GUESS_MS) {
        stats.fastSpyGuess++;
      }
    }
  }

  // Caught spy via vote
  if (!wasSpy && result.type === RESULT_TYPE.VOTE && result.isSpy) {
    stats.spyCatches++;
    // "First vote catch" — resolved quickly (under 120s)
    if (result.resolvedAtMs && gameData.startedAt) {
      const elapsed = result.resolvedAtMs - gameData.startedAt;
      if (elapsed < ACHIEVEMENT_THRESHOLDS.FIRST_VOTE_CATCH_MS) {
        stats.firstVoteCatch++;
      }
    }
  }

  // Timeout win as spy
  if (wasSpy && result.type === RESULT_TYPE.TIMEOUT && result.winner === 'spy') {
    stats.timeoutWins++;
  }

  // Check for new achievements
  const previouslyUnlocked = new Set(data.unlocked);
  const newlyUnlocked = [];

  for (const achievement of ACHIEVEMENTS) {
    if (!previouslyUnlocked.has(achievement.id) && achievement.check(stats)) {
      newlyUnlocked.push(achievement);
      data.unlocked.push(achievement.id);
    }
  }

  data.stats = stats;
  saveAchievements(uid, data);
  return newlyUnlocked;
}
