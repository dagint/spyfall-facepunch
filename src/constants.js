// Animation timing constants (ms)
export const ANIMATION = {
  REDACT_DURATION: 1200,
  SPY_REVEAL_DELAY: 1000,
  LOCATION_REVEAL_DELAY: 1600,
  ROLES_REVEAL_BASE_DELAY: 2000,
  ROLES_REVEAL_STAGGER: 200,
  CLASSIFIED_TRANSITION_DELAY: 800,
  ACHIEVEMENT_TOAST_BASE_DELAY: 2500,
  ACHIEVEMENT_TOAST_STAGGER: 1500,
  ACHIEVEMENT_TOAST_DURATION: 4000,
  REVEAL_SOUND_DELAY: 200,
};

// Game limits
export const LIMITS = {
  MAX_PLAYERS: 12,
  MIN_PLAYERS: 3,
  MIN_PLAYERS_DOUBLE_AGENT: 5,
  MAX_CUSTOM_LOCATIONS: 20,
  MAX_NAME_LENGTH: 20,
  MAX_LOCATION_NAME_LENGTH: 40,
  ROLES_PER_LOCATION: 8,
};

// Achievement timing thresholds (ms)
export const ACHIEVEMENT_THRESHOLDS = {
  FAST_SPY_GUESS_MS: 60000,
  FIRST_VOTE_CATCH_MS: 120000,
};

// Game phases
export const PHASE = {
  LOBBY: 'lobby',
  PLAYING: 'playing',
  RESULTS: 'results',
};

// Game event types (for timeline)
export const EVENT_TYPE = {
  VOTE: 'vote',
  SPY_GUESS: 'spy_guess',
  MAJORITY: 'majority',
  TIMEOUT: 'timeout',
};

// Game result types
export const RESULT_TYPE = {
  VOTE: 'vote',
  GUESS: 'guess',
  TIMEOUT: 'timeout',
  EXFILTRATION: 'exfiltration',
};

// Settings debounce delay (ms)
export const SETTINGS_DEBOUNCE_MS = 400;

// localStorage / sessionStorage keys
export const STORAGE_KEYS = {
  PLAYER_NAME: 'spyfall_name',
  ROOM: 'spyfall_room',
  CROSSED_OUT: 'spyfall_crossed',
  MUTED: 'spyfall_muted',
  THEME: 'spyfall_theme',
  ACHIEVEMENTS_PREFIX: 'spyfall_achievements_',
};
