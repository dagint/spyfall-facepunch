import { ACHIEVEMENTS } from '../data/achievements.js';

const STORAGE_PREFIX = 'spyfall_achievements_';

function getKey(uid) {
  return `${STORAGE_PREFIX}${uid}`;
}

export function loadAchievements(uid) {
  try {
    const raw = localStorage.getItem(getKey(uid));
    return raw ? JSON.parse(raw) : { unlocked: [], stats: defaultStats() };
  } catch {
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
  const wasSpy = gameData.spyId === uid || (gameData.spyIds && gameData.spyIds[uid]);

  // Update stats
  stats.gamesPlayed++;

  if (wasSpy && result.winner === 'spy') {
    stats.spyWins++;
  }
  if (!wasSpy && result.winner === 'players') {
    stats.playerWins++;
  }

  // Spy guess win
  if (wasSpy && result.type === 'guess' && result.correct) {
    stats.spyGuessWins++;
    // Fast spy guess (under 60s)
    if (gameData.startedAt) {
      const elapsed = (result.resolvedAtMs || Date.now()) - gameData.startedAt;
      if (elapsed < 60000) {
        stats.fastSpyGuess++;
      }
    }
  }

  // Caught spy on first vote
  if (!wasSpy && result.type === 'vote' && result.isSpy) {
    // Check if this was effectively the first round of votes
    const voteCount = gameData.votes ? Object.keys(gameData.votes).length : 0;
    const playerCount = gameData.roles ? Object.keys(gameData.roles).length : 0;
    if (voteCount <= playerCount) {
      stats.firstVoteCatch++;
    }
    stats.spyCatches++;
  }

  // Timeout win as spy
  if (wasSpy && result.type === 'timeout' && result.winner === 'spy') {
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
