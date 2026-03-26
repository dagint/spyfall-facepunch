/**
 * Countdown timer synced to a start timestamp.
 * Uses the game's startedAt + durationSec to compute remaining time.
 */
export function createTimer(startedAtMs, durationSec, onTick, onExpire) {
  const endMs = startedAtMs + durationSec * 1000;
  let rafId = null;
  let stopped = false;

  function tick() {
    if (stopped) return;
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((endMs - now) / 1000));
    onTick(remaining);
    if (remaining <= 0) {
      onExpire();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  tick();

  return function stop() {
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
  };
}

/** Format seconds as M:SS */
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
