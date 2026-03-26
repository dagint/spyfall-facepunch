import { el, renderTimerDisplay, renderLocationGrid, renderPromptSuggestions, renderMuteToggle, showError, sanitize } from '../components.js';
import { getState, subscribe, getActivePlayers, getGameData, isHost } from '../../game/state.js';
import { castVote, spyGuessLocation, handleTimerExpiry, advanceRound } from '../../game/actions.js';
import { LOCATIONS } from '../../data/locations.js';
import { createTimer, formatTime } from '../../utils/timer.js';
import { play } from '../../audio/sounds.js';
import { getTheme } from '../theme.js';

export function renderGame(container) {
  let unsub = null;
  let stopTimer = null;
  let crossedOut = new Set();
  let promptsDismissed = false;
  let lastTickSound = 0;

  // Try to load crossed-out state from sessionStorage
  try {
    const saved = sessionStorage.getItem('spyfall_crossed');
    if (saved) crossedOut = new Set(JSON.parse(saved));
  } catch {}

  function render() {
    const state = getState();
    const { uid, room } = state;
    const game = getGameData();

    if (!room || !game) return;

    const isSpy = game.spyId === uid || (game.spyIds && game.spyIds[uid]);
    const isCaughtSpy = game.result?.caughtSpies?.includes(uid);
    const location = game.location || LOCATIONS[game.locationIndex];
    const myRoleIndex = game.roles?.[uid];
    const myRole = (!isSpy && myRoleIndex != null) ? location.roles[myRoleIndex] : null;
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
            if (isHost()) handleTimerExpiry();
          }
        );
      } else {
        timerDiv.innerHTML = `<div class="text-2xl font-mono font-bold text-center text-slate-500">TIME'S UP</div>`;
      }
    }

    // Role card
    const roleCard = el('div', `role-card mb-6 ${isSpy ? 'role-card-spy' : 'role-card-normal'}`);

    if (isSpy) {
      if (isTerminal) {
        roleCard.innerHTML = `
          <div class="text-xs uppercase tracking-[0.2em] text-rose-400 mb-2 font-mono">$ cat /etc/dossier</div>
          <div class="text-3xl font-bold text-rose-400 mb-2 font-mono">YOU ARE THE SPY</div>
          ${isCaughtSpy ? '<div class="text-sm text-rose-400 mt-2 font-mono">[CAUGHT] You have been identified.</div>' : ''}
          ${game.spyHint ? `<div class="text-sm text-amber-400 mt-3 font-mono border border-amber-400/30 px-3 py-2">HINT: ${sanitize(game.spyHint)}</div>` : ''}
          <div class="text-sm text-slate-400 mt-3 font-mono">You don't know the location.<br/>Listen carefully and blend in.</div>
        `;
      } else {
        roleCard.innerHTML = `
          <div class="text-xs uppercase tracking-[0.2em] text-rose-400 mb-2 font-mono">CLASSIFIED</div>
          <div class="text-3xl font-bold text-rose-400 mb-2">YOU ARE THE SPY</div>
          ${isCaughtSpy ? '<div class="text-sm text-rose-400 mt-2">[CAUGHT] You have been identified.</div>' : ''}
          ${game.spyHint ? `<div class="text-sm text-amber-400 mt-3 border border-amber-400/30 px-3 py-2 rounded">HINT: ${sanitize(game.spyHint)}</div>` : ''}
          <div class="text-sm text-slate-400 mt-3">You don't know the location.<br/>Listen carefully and blend in.</div>
        `;
      }
    } else {
      if (isTerminal) {
        roleCard.innerHTML = `
          <div class="text-xs uppercase tracking-[0.2em] text-cyan-400 mb-2 font-mono">$ cat /etc/dossier</div>
          <div class="text-lg text-slate-400 mb-1 font-mono">Location</div>
          <div class="text-2xl font-bold text-cyan-400 mb-4 font-mono">${sanitize(location.name)}</div>
          <div class="text-lg text-slate-400 mb-1 font-mono">Your Role</div>
          <div class="text-xl font-bold text-slate-100 font-mono">${sanitize(myRole)}</div>
        `;
      } else {
        roleCard.innerHTML = `
          <div class="text-xs uppercase tracking-[0.2em] text-cyan-400 mb-2 font-mono">DOSSIER</div>
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
    const locTitle = el('div', 'text-xs text-slate-400 uppercase tracking-wider mb-3', 'Location Reference (tap to cross off)');
    locSection.appendChild(locTitle);

    // Merge standard + custom locations for display
    const allLocations = getAllLocations(room);
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
      sessionStorage.setItem('spyfall_crossed', JSON.stringify([...crossedOut]));
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
        voteCard.innerHTML = `<div class="text-sm font-semibold text-slate-300 mb-3">Accuse a Player</div>`;

        const voteGrid = el('div', 'space-y-2');
        players.forEach((player) => {
          if (player.uid === uid) return; // Can't vote for yourself
          if (game.result?.caughtSpies?.includes(player.uid)) return; // Skip caught spies

          const row = el('div', 'flex items-center gap-2');
          const displayName = codenames && codenames[player.uid]
            ? `${codenames[player.uid]} // ${player.name}`
            : player.name;
          const voteBtn = el('button', 'btn-secondary text-xs flex-1 !py-2', displayName);

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
            row.appendChild(badge);
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

  function showGuessModal(container, room) {
    const overlay = el('div', 'fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4');
    const modal = el('div', 'card max-w-sm w-full max-h-[80vh] overflow-y-auto');

    modal.innerHTML = `
      <div class="text-lg font-bold text-rose-400 mb-4">Guess the Location</div>
      <div class="text-xs text-slate-400 mb-3">Choose carefully — if you're wrong, you lose!</div>
    `;

    const allLocations = getAllLocations(room);
    const grid = el('div', 'space-y-2');
    allLocations.forEach((loc, i) => {
      const btn = el('button', 'btn-secondary w-full text-left !py-2 text-sm', loc.name);
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Guessing...';
        try {
          // Custom locations use name-based comparison
          if (loc.pack === 'custom') {
            await spyGuessLocation(null, loc.name);
          } else {
            // Find the actual index in LOCATIONS
            const locIdx = LOCATIONS.findIndex((l) => l.name === loc.name);
            await spyGuessLocation(locIdx);
          }
          overlay.remove();
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
    cancelBtn.addEventListener('click', () => overlay.remove());
    modal.appendChild(cancelBtn);

    overlay.appendChild(modal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  render();
  unsub = subscribe(render);

  return () => {
    if (unsub) unsub();
    if (stopTimer) stopTimer();
    sessionStorage.removeItem('spyfall_crossed');
  };
}

/** Get all locations (standard filtered by pack + custom) */
function getAllLocations(room) {
  const pack = room?.settings?.pack || 'all';
  let locs = LOCATIONS.filter((loc) => {
    if (pack === 'all') return true;
    return loc.pack === pack;
  });

  // Add custom locations
  if (room?.customLocations) {
    const customs = Object.values(room.customLocations);
    locs = [...locs, ...customs];
  }

  return locs;
}
