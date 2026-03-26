/**
 * Sound effects system using Web Audio API.
 * Generates sounds procedurally — no external audio files needed.
 */

let audioCtx = null;
let muted = localStorage.getItem('spyfall_muted') === 'true';

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/** Initialize audio context on first user interaction */
export function initAudio() {
  const handler = () => {
    getCtx();
    document.removeEventListener('click', handler);
    document.removeEventListener('keydown', handler);
  };
  document.addEventListener('click', handler);
  document.addEventListener('keydown', handler);
}

/** Play a named sound effect */
export function play(soundName) {
  if (muted) return;
  try {
    const ctx = getCtx();
    const sounds = {
      click: () => playTone(ctx, 800, 0.05, 'square', 0.15),
      error: () => playTone(ctx, 200, 0.15, 'sawtooth', 0.3),
      tick: () => playTone(ctx, 1000, 0.02, 'sine', 0.08),
      'game-start': () => playChord(ctx, [523, 659, 784], 0.3, 'sine', 0.4),
      reveal: () => playSweep(ctx, 300, 900, 0.6, 'sine', 0.3),
      vote: () => playTone(ctx, 600, 0.08, 'triangle', 0.2),
    };
    const fn = sounds[soundName];
    if (fn) fn();
  } catch {
    // Silently fail if audio not available
  }
}

export function setMuted(bool) {
  muted = bool;
  localStorage.setItem('spyfall_muted', String(bool));
}

export function isMuted() {
  return muted;
}

// --- Internal sound generators ---

function playTone(ctx, freq, duration, type, volume) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

function playChord(ctx, freqs, duration, type, volume) {
  freqs.forEach((freq, i) => {
    setTimeout(() => playTone(ctx, freq, duration, type, volume * 0.6), i * 100);
  });
}

function playSweep(ctx, startFreq, endFreq, duration, type, volume) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}
