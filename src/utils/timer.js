/**
 * Countdown timer synced to a start timestamp.
 * Uses the game's startedAt + durationSec to compute remaining time.
 * Ticks once per second to avoid unnecessary DOM updates.
 */
export function createTimer(startedAtMs, durationSec, onTick, onExpire) {
  const endMs = startedAtMs + durationSec * 1000;
  let stopped = false;
  let intervalId = null;
  let lastDisplayed = -1;

  function tick() {
    if (stopped) return;
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((endMs - now) / 1000));

    // Only call onTick when the displayed second changes
    if (remaining !== lastDisplayed) {
      lastDisplayed = remaining;
      onTick(remaining);
    }

    if (remaining <= 0) {
      stopped = true;
      clearInterval(intervalId);
      intervalId = null;
      onExpire();
    }
  }

  // Immediate first tick, then every 250ms for sub-second accuracy
  tick();
  intervalId = setInterval(tick, 250);

  return function stop() {
    stopped = true;
    if (intervalId != null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

/** Format seconds as M:SS */
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
