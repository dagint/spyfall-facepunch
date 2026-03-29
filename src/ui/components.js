import { formatTime } from '../utils/timer.js';
import { getRandomPrompts } from '../data/prompts.js';
import { isMuted, setMuted, play } from '../audio/sounds.js';
import { ANIMATION, EVENT_TYPE } from '../constants.js';
import { playerAvatar } from './icons.js';

/** Sanitize a string for safe insertion into innerHTML */
export function sanitize(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Create an element with optional classes and text */
export function el(tag, className = '', textContent = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (textContent) element.textContent = textContent;
  return element;
}

/** Render a header with back button */
export function renderHeader(container, title, onBack = null) {
  const header = el('div', 'flex items-center gap-3 mb-6');

  if (onBack) {
    const backBtn = el('button', 'btn-secondary !px-3 !py-2 text-xs', 'Back');
    backBtn.addEventListener('click', onBack);
    header.appendChild(backBtn);
  }

  const h1 = el('h1', 'text-xl font-bold text-cyan-400 font-mono', title);
  header.appendChild(h1);
  container.appendChild(header);
}

/** Render a player list with optional codenames */
export function renderPlayerList(container, players, hostUid, codenames = null) {
  const list = el('div', 'space-y-2');
  list.setAttribute('role', 'list');

  players.forEach((player) => {
    const row = el('div', 'flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700/50');
    row.setAttribute('role', 'listitem');

    // Player avatar with online indicator
    const avatarWrapper = el('div', 'relative shrink-0');
    avatarWrapper.innerHTML = playerAvatar(player.name || '??', 32);
    if (player.connected === false) {
      avatarWrapper.style.opacity = '0.4';
    }
    // Small status dot overlaid on avatar
    const dot = el('div', `absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-800 ${player.connected !== false ? 'bg-emerald-400' : 'bg-slate-500'}`);
    dot.setAttribute('aria-hidden', 'true');
    avatarWrapper.appendChild(dot);
    row.appendChild(avatarWrapper);

    // Screen reader status text
    const statusText = el('span', 'sr-only', player.connected !== false ? 'Online' : 'Offline');
    row.appendChild(statusText);

    // Name (with optional codename)
    const displayName = codenames && codenames[player.uid]
      ? `${codenames[player.uid]} // ${player.name}`
      : player.name;
    const name = el('span', `flex-1 text-sm font-medium ${codenames ? 'font-mono' : ''}`, displayName);
    row.appendChild(name);

    // Host badge
    if (player.uid === hostUid) {
      const badge = el('span', 'text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-mono', 'HOST');
      row.appendChild(badge);
    }

    // Disconnected label
    if (player.connected === false) {
      const dc = el('span', 'text-xs text-slate-500 italic', 'disconnected');
      row.appendChild(dc);
    }

    list.appendChild(row);
  });

  container.appendChild(list);
}

/** Render the countdown timer */
export function renderTimerDisplay(seconds) {
  const isWarning = seconds <= 60;
  const isDanger = seconds <= 30;

  const classes = [
    'text-4xl font-mono font-bold text-center',
    isDanger ? 'text-rose-400 timer-warning' : isWarning ? 'text-amber-400' : 'text-cyan-400',
  ].join(' ');

  // Only announce to screen readers at key thresholds to avoid flooding
  const announceThresholds = [300, 240, 180, 120, 60, 30, 10, 5, 4, 3, 2, 1, 0];
  const shouldAnnounce = announceThresholds.includes(seconds);

  return `<div class="${classes}" role="timer" ${shouldAnnounce ? 'aria-live="assertive"' : ''} aria-label="Time remaining: ${formatTime(seconds)}">${formatTime(seconds)}</div>`;
}

/** Render a location grid for reference */
export function renderLocationGrid(locations, crossedOut = new Set()) {
  const grid = el('div', 'location-grid');

  locations.forEach((loc, i) => {
    const isCrossed = crossedOut.has(i);
    const item = el('div',
      `location-item cursor-pointer select-none ${isCrossed ? 'location-item-crossed' : ''}`,
      loc.name
    );
    item.dataset.index = i;
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-pressed', String(isCrossed));
    item.setAttribute('aria-label', `${loc.name}${isCrossed ? ' (crossed out)' : ''}`);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        item.click();
      }
    });
    grid.appendChild(item);
  });

  return grid;
}

/** Render an error message */
export function showError(container, message) {
  // Remove any existing error
  const existing = container.querySelector('.error-msg');
  if (existing) existing.remove();

  const errorDiv = el('div', 'error-msg bg-rose-500/20 border border-rose-500/50 text-rose-300 text-sm px-4 py-3 rounded-lg mb-4');
  errorDiv.setAttribute('role', 'alert');
  errorDiv.style.display = 'flex';
  errorDiv.style.alignItems = 'center';
  errorDiv.style.justifyContent = 'space-between';

  const msgSpan = el('span', '', '');
  msgSpan.textContent = message;
  errorDiv.appendChild(msgSpan);

  const closeBtn = el('button', 'ml-2 text-rose-300 hover:text-white cursor-pointer font-bold', '\u00D7');
  closeBtn.setAttribute('aria-label', 'Dismiss error');
  closeBtn.addEventListener('click', () => errorDiv.remove());
  errorDiv.appendChild(closeBtn);

  container.prepend(errorDiv);

  setTimeout(() => errorDiv.remove(), 8000);
}

/** Copy text to clipboard with visual feedback */
export async function copyToClipboard(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    const original = button.textContent;
    button.textContent = 'Copied!';
    setTimeout(() => (button.textContent = original), 1500);
  } catch {
    // Fallback
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
  }
}

/** Render prompt suggestions panel (Phase 1.1) */
export function renderPromptSuggestions(pack, onDismiss, onShuffle) {
  const wrapper = el('div', 'card mb-4 border-slate-700/50');
  wrapper.setAttribute('role', 'complementary');
  wrapper.setAttribute('aria-label', 'Conversation starters');
  const header = el('div', 'flex items-center justify-between mb-2');
  header.innerHTML = `<span class="text-xs text-slate-400 uppercase tracking-wider">Conversation Starters</span>`;

  const btns = el('div', 'flex gap-2');
  const shuffleBtn = el('button', 'text-xs text-slate-500 hover:text-slate-300 cursor-pointer', 'Shuffle');
  shuffleBtn.addEventListener('click', () => {
    play('click');
    onShuffle();
  });
  const dismissBtn = el('button', 'text-xs text-slate-500 hover:text-slate-300 cursor-pointer', 'Dismiss');
  dismissBtn.addEventListener('click', () => {
    play('click');
    onDismiss();
  });
  btns.appendChild(shuffleBtn);
  btns.appendChild(dismissBtn);
  header.appendChild(btns);
  wrapper.appendChild(header);

  const prompts = getRandomPrompts(pack, 3);
  const list = el('div', 'space-y-1.5');
  prompts.forEach((prompt) => {
    const item = el('div', 'text-xs text-slate-400 pl-2 border-l-2 border-slate-700', prompt);
    list.appendChild(item);
  });
  wrapper.appendChild(list);
  return wrapper;
}

/** Render mute toggle button (Phase 2.1) */
export function renderMuteToggle() {
  const btn = el('button', 'text-xs px-2 py-1 rounded text-slate-400 hover:text-slate-200 cursor-pointer');
  btn.textContent = isMuted() ? 'UNMUTE' : 'MUTE';
  btn.setAttribute('aria-label', isMuted() ? 'Unmute sound effects' : 'Mute sound effects');
  btn.setAttribute('aria-pressed', String(isMuted()));
  btn.addEventListener('click', () => {
    const newMuted = !isMuted();
    setMuted(newMuted);
    btn.textContent = newMuted ? 'UNMUTE' : 'MUTE';
    btn.setAttribute('aria-label', newMuted ? 'Unmute sound effects' : 'Mute sound effects');
    btn.setAttribute('aria-pressed', String(newMuted));
    if (!newMuted) play('click');
  });
  return btn;
}

/** Wrap an element with a declassify redaction effect (Phase 1.3) */
export function wrapRedacted(element, delayMs = 0) {
  const wrapper = el('div', 'redacted');
  wrapper.style.display = 'inline-block';
  const bar = el('div', 'redacted-bar');
  bar.style.animation = `declassify ${ANIMATION.REDACT_DURATION / 1000}s ease-out ${delayMs}ms forwards`;
  element.style.animation = `declassifyText ${ANIMATION.REDACT_DURATION / 1000}s ease-out ${delayMs}ms forwards`;
  element.style.opacity = '0';
  wrapper.appendChild(element);
  wrapper.appendChild(bar);
  return wrapper;
}

/** Render a single achievement badge (Phase 2.3) */
export function renderAchievementBadge(achievement) {
  const badge = el('span', 'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono');
  badge.title = achievement.desc;
  badge.textContent = `${achievement.icon} ${achievement.name}`;
  return badge;
}

/** Render an achievement toast notification (Phase 2.3) */
export function renderAchievementToast(achievement) {
  const toast = el('div', 'fixed bottom-4 right-4 z-50 card border-amber-500/50 bg-slate-800 shadow-lg max-w-xs');
  toast.setAttribute('role', 'alert');
  toast.style.animation = 'fadeIn 0.3s ease-out';

  let dismissed = false;
  let autoTimer = null;
  const dismissToast = () => {
    if (dismissed) return;
    dismissed = true;
    clearTimeout(autoTimer);
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
    document.removeEventListener('keydown', keyHandler);
  };

  toast.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="text-2xl">${sanitize(achievement.icon)}</span>
      <div class="flex-1">
        <div class="text-xs text-amber-400 uppercase tracking-wider font-mono">Achievement Unlocked</div>
        <div class="text-sm font-bold text-slate-100">${sanitize(achievement.name)}</div>
        <div class="text-xs text-slate-400">${sanitize(achievement.desc)}</div>
      </div>
      <button class="text-slate-500 hover:text-white cursor-pointer text-lg leading-none" aria-label="Dismiss">&times;</button>
    </div>
  `;
  toast.querySelector('button').addEventListener('click', dismissToast);

  const keyHandler = (e) => { if (e.key === 'Escape') dismissToast(); };
  document.addEventListener('keydown', keyHandler);

  document.body.appendChild(toast);
  autoTimer = setTimeout(dismissToast, ANIMATION.ACHIEVEMENT_TOAST_DURATION);
  return toast;
}

/** Render timeline of game events (Phase 2.2) */
export function renderTimeline(events, startedAt, players, codenames) {
  const wrapper = el('div', 'relative');
  const line = el('div', 'timeline-line');
  wrapper.appendChild(line);

  if (!events || events.length === 0) {
    const empty = el('div', 'text-xs text-slate-500 pl-8 py-2', 'No events recorded.');
    wrapper.appendChild(empty);
    return wrapper;
  }

  const playerMap = {};
  players.forEach((p) => {
    playerMap[p.uid] = codenames && codenames[p.uid]
      ? `${codenames[p.uid]} // ${p.name}`
      : p.name;
  });

  const typeColors = {
    [EVENT_TYPE.VOTE]: 'bg-amber-400',
    [EVENT_TYPE.SPY_GUESS]: 'bg-rose-400',
    [EVENT_TYPE.MAJORITY]: 'bg-emerald-400',
    [EVENT_TYPE.TIMEOUT]: 'bg-slate-400',
  };

  const typeLabels = {
    [EVENT_TYPE.VOTE]: 'VOTE',
    [EVENT_TYPE.SPY_GUESS]: 'SPY GUESS',
    [EVENT_TYPE.MAJORITY]: 'MAJORITY',
    [EVENT_TYPE.TIMEOUT]: 'TIMEOUT',
  };

  events.forEach((evt) => {
    const entry = el('div', 'timeline-entry');
    const dot = el('div', `timeline-dot ${typeColors[evt.type] || 'bg-slate-400'}`);
    entry.appendChild(dot);

    const elapsedSec = Math.floor((evt.ts - startedAt) / 1000);
    const mins = Math.floor(elapsedSec / 60);
    const secs = elapsedSec % 60;
    const timeStr = `T+${mins}:${secs.toString().padStart(2, '0')}`;

    let desc = '';
    if (evt.type === EVENT_TYPE.VOTE) {
      desc = `${sanitize(playerMap[evt.actor] || 'Unknown')} voted for ${sanitize(playerMap[evt.target] || 'Unknown')}`;
    } else if (evt.type === EVENT_TYPE.SPY_GUESS) {
      desc = `${sanitize(playerMap[evt.actor] || 'Unknown')} guessed "${sanitize(evt.guessedLocation || 'a location')}"`;
    } else if (evt.type === EVENT_TYPE.MAJORITY) {
      desc = `Majority reached against ${sanitize(playerMap[evt.target] || 'Unknown')}`;
    } else if (evt.type === EVENT_TYPE.TIMEOUT) {
      desc = 'Time expired';
    }

    entry.innerHTML += `
      <div class="flex items-baseline gap-2">
        <span class="text-xs font-mono text-slate-500">${timeStr}</span>
        <span class="text-xs font-mono px-1.5 py-0.5 rounded ${typeColors[evt.type] || 'bg-slate-400'} text-slate-900">${typeLabels[evt.type] || evt.type}</span>
      </div>
      <div class="text-xs text-slate-300 mt-0.5">${desc}</div>
    `;
    wrapper.appendChild(entry);
  });

  return wrapper;
}
