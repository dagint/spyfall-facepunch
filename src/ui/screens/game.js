import { el, renderTimerDisplay, renderLocationGrid, renderPromptSuggestions, renderMuteToggle, showError, sanitize } from '../components.js';
import { getState, subscribe, getActivePlayers, getGameData, isHost, onError } from '../../game/state.js';
import { castVote, spyGuessLocation, handleTimerExpiry, advanceRound } from '../../game/actions.js';
import { LOCATIONS } from '../../data/locations.js';
import { createTimer } from '../../utils/timer.js';
import { play } from '../../audio/sounds.js';
import { getTheme } from '../theme.js';
import { getFilteredLocations } from '../../utils/gameHelpers.js';
import { STORAGE_KEYS } from '../../constants.js';
import { iconEye, iconDocument } from '../icons.js';

/** Render the active game screen (timer, role card, voting, spy guess). */
export function renderGame(container) {
  let unsub = null;
  let stopTimer = null;
  let crossedOut = new Set();
  let promptsDismissed = false;
  let lastTickSound = 0;
  let activeOverlay = null;
  let activeKeyHandler = null;
  let lastStateKey = null;
  let watchdogTimeout = null;

  // Try to load crossed-out state from sessionStorage
  try {
    const saved = sessionStorage.getItem(STORAGE_KEYS.CROSSED_OUT);
    if (saved) crossedOut = new Set(JSON.parse(saved));
  } catch (err) {
    console.warn('Failed to restore crossed-out state:', err);
  }

  function render() {
    const state = getState();
    const { uid, room } = state;
    const game = getGameData();

    if (!room || !game) return;

    const myRoleData = state.myRole;

    // Wait for per-player role data to arrive from Firebase listener
    if (!myRoleData) {
      container.innerHTML = '<div class="text-center text-slate-400 mt-12 font-mono">Loading dossier...</div>';
      return;
    }

    // Skip re-render if game state hasn't meaningfully changed
    const stateKey = JSON.stringify({
      votes: game.votes,
      result: game.result,
      exfiltration: game.exfiltration,
      myRole: myRoleData,
      players: Object.keys(room.players || {}).map(uid => room.players[uid].connected).join(','),
    });
    if (lastStateKey !== null && stateKey === lastStateKey) return;
    lastStateKey = stateKey;

    const isSpy = myRoleData.isSpy;
    const isCaughtSpy = game.result?.caughtSpies?.includes(uid);
    const location = myRoleData.location; // null for spy
    const myRole = myRoleData.role; // null for spy
    const players = getActivePlayers();
    const codenames = game.codenames || null;
    const isTerminal = getTheme() === 'terminal';

    container.innerHTML = '';

    // Header with mute toggle
    const headerBar = el('div', 'flex items-center justify-end mb-2');
    headerBar.appendChild(renderMuteToggle());
    container.appendChild(headerBar);

    // Timer or Progress bar (incident mode)
    if (game.exfiltration) {
      // Incident Response Mode — progress bar
      const exf = game.exfiltration;
      const progDiv = el('div', 'mb-6');
      const isDanger = exf.progress >= 75;
      progDiv.innerHTML = `
        <div class="text-xs text-center text-slate-400 uppercase tracking-wider mb-2 font-mono">
          DATA EXFILTRATION // ROUND ${exf.roundNumber}
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${isDanger ? 'progress-danger' : ''}" style="width: ${exf.progress}%"></div>
        </div>
        <div class="text-center text-xs mt-1 font-mono ${isDanger ? 'text-rose-400' : 'text-slate-400'}">${exf.progress}%</div>
      `;
      container.appendChild(progDiv);
    } else {
      // Standard timer
      const timerDiv = el('div', 'mb-6');
      timerDiv.id = 'timerDisplay';
      container.appendChild(timerDiv);

      // Stop previous timer
      if (stopTimer) stopTimer();

      if (!game.result || game.result.partial) {
        stopTimer = createTimer(
          game.startedAt,
          game.durationSec,
          (remaining) => {
            const display = document.getElementById('timerDisplay');
            if (display) display.innerHTML = renderTimerDisplay(remaining);
            // Tick sound when <=30s
            if (remaining <= 30 && remaining > 0) {
              const now = Date.now();
              if (now - lastTickSound >= 1000) {
                play('tick');
                lastTickSound = now;
              }
            }
          },
          () => {
            if (isHost()) {
              handleTimerExpiry();
            } else {
              // Watchdog: if host hasn't finalized within 5s, lowest-UID non-host steps in
              const activePlayers = getActivePlayers();
              const nonHostUids = activePlayers
                .filter((p) => p.uid !== room.host)
                .map((p) => p.uid)
                .sort();
              if (nonHostUids[0] === uid) {
                watchdogTimeout = setTimeout(() => {
                  const currentGame = getGameData();
                  if (currentGame && !currentGame.result) {
                    handleTimerExpiry();
                  }
                }, 5000);
              }
            }
          }
        );
      } else {
        timerDiv.innerHTML = `<div class="text-2xl font-mono font-bold text-center text-slate-500">TIME'S UP</div>`;
      }
    }

    // Role card
    const roleCard = el('div', `role-card mb-6 ${isSpy ? 'role-card-spy' : 'role-card-normal'}`);
    roleCard.setAttribute('role', 'region');
    roleCard.setAttribute('aria-label', isSpy ? 'Your role: Spy' : 'Your dossier');

    if (isSpy) {
      if (isTerminal) {
        roleCard.innerHTML = `
          <div class="text-xs uppercase tracking-[0.2em] text-rose-400 mb-2 font-mono">$ cat /etc/dossier</div>
          <div class="text-rose-400 opacity-50 mb-2">${iconEye(36)}</div>
          <div class="text-3xl font-bold text-rose-400 mb-2 font-mono">YOU ARE THE SPY</div>
          ${isCaughtSpy ? '<div class="text-sm text-rose-400 mt-2 font-mono">[CAUGHT] You have been identified.</div>' : ''}
          ${myRoleData.spyHint ? `<div class="text-sm text-amber-400 mt-3 font-mono border border-amber-400/30 px-3 py-2">HINT: ${sanitize(myRoleData.spyHint)}</div>` : ''}
          <div class="text-sm text-slate-400 mt-3 font-mono">You don't know the location.<br/>Listen carefully and blend in.</div>
        `;
      } else {
        roleCard.innerHTML = `
          <div class="text-xs uppercase tracking-[0.2em] text-rose-400 mb-2 font-mono">CLASSIFIED</div>
          <div class="text-rose-400 opacity-50 mb-2">${iconEye(36)}</div>
          <div class="text-3xl font-bold text-rose-400 mb-2">YOU ARE THE SPY</div>
          ${isCaughtSpy ? '<div class="text-sm text-rose-400 mt-2">[CAUGHT] You have been identified.</div>' : ''}
          ${myRoleData.spyHint ? `<div class="text-sm text-amber-400 mt-3 border border-amber-400/30 px-3 py-2 rounded">HINT: ${sanitize(myRoleData.spyHint)}</div>` : ''}
          <div class="text-sm text-slate-400 mt-3">You don't know the location.<br/>Listen carefully and blend in.</div>
        `;
      }
    } else {
      if (isTerminal) {
        roleCard.innerHTML = `
          <div class="text-xs uppercase tracking-[0.2em] text-cyan-400 mb-2 font-mono">$ cat /etc/dossier</div>
          <div class="text-cyan-400 opacity-40 mb-3">${iconDocument(32)}</div>
          <div class="text-lg text-slate-400 mb-1 font-mono">Location</div>
          <div class="text-2xl font-bold text-cyan-400 mb-4 font-mono">${sanitize(location.name)}</div>
          <div class="text-lg text-slate-400 mb-1 font-mono">Your Role</div>
          <div class="text-xl font-bold text-slate-100 font-mono">${sanitize(myRole)}</div>
        `;
      } else {
        roleCard.innerHTML = `
          <div class="text-xs uppercase tracking-[0.2em] text-cyan-400 mb-2 font-mono">DOSSIER</div>
          <div class="text-cyan-400 opacity-40 mb-3">${iconDocument(32)}</div>
          <div class="text-lg text-slate-400 mb-1">Location</div>
          <div class="text-2xl font-bold text-cyan-400 mb-4">${sanitize(location.name)}</div>
          <div class="text-lg text-slate-400 mb-1">Your Role</div>
          <div class="text-xl font-bold text-slate-100">${sanitize(myRole)}</div>
        `;
      }
    }
    container.appendChild(roleCard);

    // Prompt suggestions (Phase 1.1)
    if (!promptsDismissed && (!game.result || game.result.partial)) {
      const pack = room.settings?.pack || 'all';
      const promptPanel = renderPromptSuggestions(
        pack,
        () => { promptsDismissed = true; render(); },
        () => render()
      );
      container.appendChild(promptPanel);
    }

    // Location reference list (for crossing off)
    const locSection = el('div', 'card mb-4');
    locSection.setAttribute('role', 'region');
    locSection.setAttribute('aria-label', 'Location reference');
    const locTitle = el('div', 'text-xs text-slate-400 uppercase tracking-wider mb-3', 'Location Reference (tap to cross off)');
    locSection.appendChild(locTitle);

    // Merge standard + custom locations for display
    const allLocations = getFilteredLocations(room?.settings?.pack || 'all', room?.customLocations);
    const locGrid = renderLocationGrid(allLocations, crossedOut);
    locGrid.addEventListener('click', (e) => {
      const item = e.target.closest('.location-item');
      if (!item) return;
      const idx = parseInt(item.dataset.index);
      if (crossedOut.has(idx)) {
        crossedOut.delete(idx);
        item.classList.remove('location-item-crossed');
      } else {
        crossedOut.add(idx);
        item.classList.add('location-item-crossed');
      }
      play('click');
      sessionStorage.setItem(STORAGE_KEYS.CROSSED_OUT, JSON.stringify([...crossedOut]));
    });
    locSection.appendChild(locGrid);
    container.appendChild(locSection);

    // Actions section (voting + spy guess)
    if (!game.result || game.result.partial) {
      const actionsDiv = el('div', 'space-y-3 mt-auto pt-4');

      // Caught spy banner (double agent)
      if (game.result?.partial && game.result?.caughtSpies?.length > 0) {
        const caughtBanner = el('div', 'card border-amber-500/50 text-center text-sm text-amber-400 mb-3');
        const caughtNames = game.result.caughtSpies.map((uid) => {
          const p = players.find((pl) => pl.uid === uid);
          return codenames && codenames[uid] ? `${codenames[uid]}` : (p?.name || 'Unknown');
        });
        caughtBanner.textContent = `Spy caught: ${caughtNames.join(', ')} — find the remaining spy!`;
        actionsDiv.appendChild(caughtBanner);
      }

      // Vote/accuse section
      if (!isCaughtSpy) {
        const voteCard = el('div', 'card');
        voteCard.setAttribute('aria-label', 'Vote to accuse a player');
        voteCard.innerHTML = `<div class="text-sm font-semibold text-slate-300 mb-3">Accuse a Player</div>`;

        const voteGrid = el('div', 'space-y-2');
        voteGrid.setAttribute('aria-live', 'polite');
        voteGrid.setAttribute('aria-relevant', 'text');
        players.forEach((player) => {
          if (player.uid === uid) return; // Can't vote for yourself
          if (game.result?.caughtSpies?.includes(player.uid)) return; // Skip caught spies

          const row = el('div', 'flex items-center gap-2');
          const displayName = codenames && codenames[player.uid]
            ? `${codenames[player.uid]} // ${player.name}`
            : player.name;
          const voteBtn = el('button', 'btn-secondary text-xs flex-1 !py-2', displayName);
          voteBtn.setAttribute('aria-label', `Vote for ${displayName}`);

          // Highlight if already voted for this player
          const myVote = game.votes?.[uid];
          if (myVote === player.uid) {
            voteBtn.className = 'btn-primary text-xs flex-1 !py-2';
          }

          voteBtn.addEventListener('click', () => {
            play('vote');
            castVote(player.uid);
          });
          row.appendChild(voteBtn);

          // Show vote count
          const voteCount = game.votes
            ? Object.values(game.votes).filter((v) => v === player.uid).length
            : 0;
          if (voteCount > 0) {
            const badge = el('span', 'text-xs text-amber-400 font-mono w-8 text-center', `${voteCount}`);
            const srVoteCount = el('span', 'sr-only', `${voteCount} vote${voteCount !== 1 ? 's' : ''}`);
            badge.setAttribute('aria-hidden', 'true');
            row.appendChild(badge);
            row.appendChild(srVoteCount);
          }

          voteGrid.appendChild(row);
        });
        voteCard.appendChild(voteGrid);
        actionsDiv.appendChild(voteCard);
      }

      // Spy guess button
      if (isSpy && !isCaughtSpy) {
        const guessBtn = el('button', 'btn-danger w-full', 'Guess the Location');
        guessBtn.addEventListener('click', () => showGuessModal(container, room));
        actionsDiv.appendChild(guessBtn);
      }

      // Advance round button (incident mode, host only)
      if (game.exfiltration && isHost()) {
        const advBtn = el('button', 'btn-primary w-full', `Advance Round (${game.exfiltration.progress}% → ${Math.min(100, game.exfiltration.progress + game.exfiltration.incrementPerRound)}%)`);
        advBtn.addEventListener('click', async () => {
          advBtn.disabled = true;
          await advanceRound();
        });
        actionsDiv.appendChild(advBtn);
      }

      container.appendChild(actionsDiv);
    }
  }

  let previousFocus = null;

  function removeOverlay(overlay, keyHandler) {
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    overlay.remove();
    if (activeOverlay === overlay) { activeOverlay = null; activeKeyHandler = null; }
    // Return focus to element that opened the modal
    if (previousFocus && previousFocus.isConnected) {
      previousFocus.focus();
      previousFocus = null;
    }
  }

  function showGuessModal(container, room) {
    previousFocus = document.activeElement;
    const overlay = el('div', 'fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4');
    activeOverlay = overlay;
    const modal = el('div', 'card max-w-sm w-full max-h-[80vh] overflow-y-auto');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Guess the location');

    modal.innerHTML = `
      <div class="text-lg font-bold text-rose-400 mb-4">Guess the Location</div>
      <div class="text-xs text-slate-400 mb-3">Choose carefully — if you're wrong, you lose!</div>
    `;

    const allLocations = getFilteredLocations(room?.settings?.pack || 'all', room?.customLocations);
    const grid = el('div', 'space-y-2');
    allLocations.forEach((loc) => {
      const btn = el('button', 'btn-secondary w-full text-left !py-2 text-sm', loc.name);
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Guessing...';
        try {
          if (loc.pack === 'custom') {
            await spyGuessLocation(null, loc.name);
          } else {
            const locIdx = LOCATIONS.findIndex((l) => l.name === loc.name);
            await spyGuessLocation(locIdx);
          }
          removeOverlay(overlay, keyHandler);
        } catch (err) {
          showError(modal, err.message);
          btn.disabled = false;
          btn.textContent = loc.name;
        }
      });
      grid.appendChild(btn);
    });
    modal.appendChild(grid);

    const cancelBtn = el('button', 'btn-secondary w-full mt-4', 'Cancel');
    cancelBtn.addEventListener('click', () => removeOverlay(overlay, keyHandler));
    modal.appendChild(cancelBtn);

    overlay.appendChild(modal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) removeOverlay(overlay, keyHandler);
    });
    document.body.appendChild(overlay);

    // Focus trap and keyboard handling
    const focusableEls = modal.querySelectorAll('button');
    if (focusableEls.length > 0) focusableEls[0].focus();

    const keyHandler = (e) => {
      if (e.key === 'Escape') {
        removeOverlay(overlay, keyHandler);
        return;
      }
      // Tab focus trap
      if (e.key === 'Tab') {
        const focusable = modal.querySelectorAll('button:not([disabled])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    activeKeyHandler = keyHandler;
    document.addEventListener('keydown', keyHandler);
  }

  render();
  unsub = subscribe(render);
  const errorUnsub = onError((msg) => showError(container, msg));

  return () => {
    if (unsub) unsub();
    errorUnsub();
    if (stopTimer) stopTimer();
    if (watchdogTimeout) { clearTimeout(watchdogTimeout); watchdogTimeout = null; }
    if (activeOverlay) {
      if (activeKeyHandler) { document.removeEventListener('keydown', activeKeyHandler); activeKeyHandler = null; }
      activeOverlay.remove(); activeOverlay = null; previousFocus = null;
    }
    sessionStorage.removeItem(STORAGE_KEYS.CROSSED_OUT);
  };
}
