import { el, wrapRedacted, renderTimeline, renderAchievementToast, renderMuteToggle, sanitize } from '../components.js';
import { getState, subscribe, isHost, getPlayers, getGameData } from '../../game/state.js';
import { playAgain, leaveRoom } from '../../game/actions.js';
import { LOCATIONS } from '../../data/locations.js';
import { getSpyUids } from '../../utils/gameHelpers.js';
import { processGameResult } from '../../game/achievements.js';
import { play } from '../../audio/sounds.js';
import { ANIMATION, RESULT_TYPE } from '../../constants.js';
import { iconShield, iconSkull } from '../icons.js';

/** Render the results screen (winner reveal, roles, timeline, achievements). */
export function renderResults(container) {
  let unsub = null;
  let animationPlayed = false;
  let achievementsProcessed = false;
  let lastStateKey = null;

  function render() {
    const state = getState();
    const { uid, room } = state;
    const game = getGameData();

    if (!room || !game || !game.result) return;
    if (game.result.partial) return; // Don't show results for partial (double agent mid-game)

    // Skip re-render if state hasn't meaningfully changed
    const stateKey = JSON.stringify({
      result: game.result,
      phase: room.phase,
      events: game.events ? Object.keys(game.events).length : 0,
    });
    if (lastStateKey !== null && stateKey === lastStateKey) return;
    lastStateKey = stateKey;

    const result = game.result;
    const location = result.location || LOCATIONS[result.locationIndex];
    const players = getPlayers();
    const host = isHost();
    const codenames = game.codenames || null;

    // Determine spy(s) from result reveal data
    const spyUids = getSpyUids(result);
    const spies = spyUids.map((sid) => players.find((p) => p.uid === sid)).filter(Boolean);
    const spyNames = spies.map((s) => {
      if (codenames && codenames[s.uid]) return `${codenames[s.uid]} // ${s.name}`;
      return s.name;
    }).join(', ') || 'Unknown';

    const shouldAnimate = !animationPlayed;
    animationPlayed = true;

    container.innerHTML = '';

    // Play reveal sound
    if (shouldAnimate) {
      setTimeout(() => play('reveal'), ANIMATION.REVEAL_SOUND_DELAY);
    }

    // Process achievements (once)
    if (!achievementsProcessed && uid) {
      achievementsProcessed = true;
      try {
        const newAchievements = processGameResult(uid, game, result);
        newAchievements.forEach((ach, i) => {
          setTimeout(() => renderAchievementToast(ach), ANIMATION.ACHIEVEMENT_TOAST_BASE_DELAY + i * ANIMATION.ACHIEVEMENT_TOAST_STAGGER);
        });
      } catch (err) {
        console.warn('Failed to process achievements:', err);
      }
    }

    // Mute toggle
    const headerBar = el('div', 'flex items-center justify-end mb-2');
    headerBar.appendChild(renderMuteToggle());
    container.appendChild(headerBar);

    // CLASSIFIED → DECLASSIFIED header
    const classifiedHeader = el('div', 'text-center mb-4');
    if (shouldAnimate) {
      classifiedHeader.innerHTML = `
        <div class="text-xs uppercase tracking-[0.3em] text-slate-500 font-mono transition-all duration-1000" id="classifiedLabel">CLASSIFIED</div>
      `;
      setTimeout(() => {
        const lbl = document.getElementById('classifiedLabel');
        if (lbl) {
          lbl.textContent = 'DECLASSIFIED';
          lbl.className = 'text-xs uppercase tracking-[0.3em] text-amber-400 font-mono';
        }
      }, ANIMATION.CLASSIFIED_TRANSITION_DELAY);
    } else {
      classifiedHeader.innerHTML = `<div class="text-xs uppercase tracking-[0.3em] text-amber-400 font-mono">DECLASSIFIED</div>`;
    }
    container.appendChild(classifiedHeader);

    // Result header
    const banner = el('div', `card mb-6 text-center ${result.winner === 'spy' ? 'border-rose-500' : 'border-emerald-500'}`);
    banner.setAttribute('role', 'status');

    let title, subtitle;
    if (result.type === RESULT_TYPE.VOTE) {
      if (result.isSpy) {
        title = 'SPY CAUGHT!';
        subtitle = `The group correctly identified ${sanitize(spyNames)}!`;
      } else {
        title = 'WRONG ACCUSATION!';
        subtitle = `The group accused the wrong person. The spy wins!`;
      }
    } else if (result.type === RESULT_TYPE.GUESS) {
      if (result.correct) {
        title = 'SPY WINS!';
        subtitle = `${sanitize(spyNames)} correctly guessed the location!`;
      } else {
        title = 'SPY GUESSED WRONG!';
        subtitle = `${sanitize(spyNames)} guessed &quot;${sanitize(result.guessedLocation)}&quot; — wrong!`;
      }
    } else if (result.type === RESULT_TYPE.EXFILTRATION) {
      title = 'DATA EXFILTRATED!';
      subtitle = 'The spy completed data exfiltration before being caught!';
    } else {
      title = 'TIME\'S UP!';
      subtitle = 'The spy survived! Nobody was voted out in time.';
    }

    const winnerLabel = result.winner === 'spy' ? 'Spy Wins' : 'Players Win';
    const winnerColor = result.winner === 'spy' ? 'text-rose-400' : 'text-emerald-400';

    const winnerIcon = result.winner === 'spy'
      ? `<div class="text-rose-400 opacity-60 mb-2 flex justify-center">${iconSkull(32)}</div>`
      : `<div class="text-emerald-400 opacity-60 mb-2 flex justify-center">${iconShield(32)}</div>`;
    banner.innerHTML = `
      ${winnerIcon}
      <div class="text-xs uppercase tracking-[0.2em] ${winnerColor} mb-2 font-mono">${winnerLabel}</div>
      <div class="text-2xl font-bold mb-2">${title}</div>
      <div class="text-sm text-slate-400">${subtitle}</div>
    `;
    container.appendChild(banner);

    // Reveal section with declassify animation
    const revealCard = el('div', 'card mb-4');
    const revealInner = el('div', 'space-y-4');

    // Spy reveal
    const spyReveal = el('div', 'text-center');
    const spyLabel = el('div', 'text-xs text-slate-400 uppercase tracking-wider mb-1', spyUids.length > 1 ? 'The Spies Were' : 'The Spy Was');
    const spyNameEl = el('div', 'text-xl font-bold text-rose-400', spyNames);
    spyReveal.appendChild(spyLabel);
    if (shouldAnimate) {
      spyReveal.appendChild(wrapRedacted(spyNameEl, ANIMATION.SPY_REVEAL_DELAY));
    } else {
      spyReveal.appendChild(spyNameEl);
    }
    revealInner.appendChild(spyReveal);

    // Location reveal
    const locReveal = el('div', 'text-center');
    const locLabel = el('div', 'text-xs text-slate-400 uppercase tracking-wider mb-1', 'The Location Was');
    const locNameEl = el('div', 'text-xl font-bold text-cyan-400', location.name);
    locReveal.appendChild(locLabel);
    if (shouldAnimate) {
      locReveal.appendChild(wrapRedacted(locNameEl, ANIMATION.LOCATION_REVEAL_DELAY));
    } else {
      locReveal.appendChild(locNameEl);
    }
    revealInner.appendChild(locReveal);

    revealCard.appendChild(revealInner);
    container.appendChild(revealCard);

    // All roles
    const rolesCard = el('div', 'card mb-4');
    rolesCard.innerHTML = `<div class="text-sm font-semibold text-slate-300 mb-3">All Roles</div>`;
    const rolesList = el('div', 'space-y-2');

    players.forEach((player) => {
      const isPlayerSpy = spyUids.includes(player.uid);
      const roleIndex = result.roles?.[player.uid];
      const roleName = isPlayerSpy ? 'THE SPY' : (roleIndex != null ? location.roles[roleIndex] : 'Unknown');
      const displayName = codenames && codenames[player.uid]
        ? `${codenames[player.uid]} // ${player.name}`
        : player.name;

      const row = el('div', `flex items-center justify-between px-3 py-2 rounded-lg ${isPlayerSpy ? 'bg-rose-500/10 border border-rose-500/30' : 'bg-slate-700/30'}`);
      row.innerHTML = `
        <span class="text-sm font-medium ${isPlayerSpy ? 'text-rose-400' : 'text-slate-200'}">${sanitize(displayName)}</span>
        <span class="text-xs font-mono ${isPlayerSpy ? 'text-rose-400' : 'text-slate-400'}">${sanitize(roleName)}</span>
      `;

      if (shouldAnimate) {
        const wrapped = wrapRedacted(row, ANIMATION.ROLES_REVEAL_BASE_DELAY + players.indexOf(player) * ANIMATION.ROLES_REVEAL_STAGGER);
        wrapped.style.display = 'block';
        rolesList.appendChild(wrapped);
      } else {
        rolesList.appendChild(row);
      }
    });
    rolesCard.appendChild(rolesList);
    container.appendChild(rolesCard);

    // Post-game timeline (Phase 2.2)
    if (game.events) {
      const timelineCard = el('div', 'card mb-4');
      const timelineHeader = el('div', 'flex items-center justify-between mb-3 cursor-pointer');
      timelineHeader.setAttribute('role', 'button');
      timelineHeader.setAttribute('aria-expanded', 'false');
      timelineHeader.setAttribute('aria-label', 'Toggle incident timeline');
      timelineHeader.innerHTML = `
        <span class="text-sm font-semibold text-slate-300 font-mono">INCIDENT TIMELINE // POST-MORTEM</span>
        <span class="text-xs text-slate-500" id="timelineToggle">Show</span>
      `;
      timelineCard.appendChild(timelineHeader);

      const timelineBody = el('div', '');
      timelineBody.style.display = 'none';

      // Convert events object to sorted array
      const eventsArr = Object.values(game.events).sort((a, b) => a.ts - b.ts);
      const timeline = renderTimeline(eventsArr, game.startedAt, players, codenames);
      timelineBody.appendChild(timeline);
      timelineCard.appendChild(timelineBody);

      timelineHeader.addEventListener('click', () => {
        const isHidden = timelineBody.style.display === 'none';
        timelineBody.style.display = isHidden ? 'block' : 'none';
        timelineHeader.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
        const toggle = timelineCard.querySelector('#timelineToggle');
        if (toggle) toggle.textContent = isHidden ? 'Hide' : 'Show';
      });

      container.appendChild(timelineCard);
    }

    // Post-game mini stats for all players
    const statsCard = el('div', 'card mb-4');
    statsCard.innerHTML = `<div class="text-sm font-semibold text-slate-300 mb-3 font-mono">GAME STATS</div>`;
    const statsGrid = el('div', 'grid grid-cols-2 gap-3 text-center');

    const durationMs = game.result.resolvedAtMs && game.startedAt
      ? game.result.resolvedAtMs - game.startedAt
      : null;
    const durationStr = durationMs ? `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s` : '—';

    const resultTypeLabels = { [RESULT_TYPE.VOTE]: 'Vote', [RESULT_TYPE.GUESS]: 'Spy Guess', [RESULT_TYPE.TIMEOUT]: 'Timeout', [RESULT_TYPE.EXFILTRATION]: 'Exfiltration' };

    statsGrid.innerHTML = `
      <div class="bg-slate-700/30 rounded-lg p-2">
        <div class="text-xs text-slate-500">Duration</div>
        <div class="text-sm font-mono text-slate-200">${durationStr}</div>
      </div>
      <div class="bg-slate-700/30 rounded-lg p-2">
        <div class="text-xs text-slate-500">Ended By</div>
        <div class="text-sm font-mono text-slate-200">${resultTypeLabels[result.type] || result.type}</div>
      </div>
      <div class="bg-slate-700/30 rounded-lg p-2">
        <div class="text-xs text-slate-500">Players</div>
        <div class="text-sm font-mono text-slate-200">${players.length}</div>
      </div>
      <div class="bg-slate-700/30 rounded-lg p-2">
        <div class="text-xs text-slate-500">Location Pack</div>
        <div class="text-sm font-mono text-slate-200">${sanitize(location.pack || 'all')}</div>
      </div>
    `;
    statsCard.appendChild(statsGrid);
    container.appendChild(statsCard);

    // Actions (always visible immediately)
    const actionsDiv = el('div', 'mt-auto pt-4 space-y-3');

    if (host) {
      const againBtn = el('button', 'btn-primary w-full', 'Play Again');
      againBtn.addEventListener('click', async () => {
        againBtn.disabled = true;
        againBtn.textContent = 'Resetting...';
        await playAgain();
      });
      actionsDiv.appendChild(againBtn);
    } else {
      const waiting = el('div', 'text-center text-slate-400 text-sm', 'Waiting for host to start next round...');
      actionsDiv.appendChild(waiting);
    }

    const leaveBtn = el('button', 'btn-secondary w-full', 'Leave Room');
    leaveBtn.addEventListener('click', () => leaveRoom());
    actionsDiv.appendChild(leaveBtn);

    container.appendChild(actionsDiv);
  }

  render();
  unsub = subscribe(render);

  return () => {
    if (unsub) unsub();
  };
}
