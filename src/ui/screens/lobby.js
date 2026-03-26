import { el, renderHeader, renderPlayerList, renderAchievementBadge, showError, copyToClipboard, sanitize } from '../components.js';
import { getState, subscribe, isHost, getPlayers, getActivePlayers } from '../../game/state.js';
import { updateSettings, startGame, leaveRoom, addCustomLocation, removeCustomLocation } from '../../game/actions.js';
import { navigate } from '../../router.js';
import { loadAchievements } from '../../game/achievements.js';
import { ACHIEVEMENTS } from '../../data/achievements.js';

export function renderLobby(container) {
  let unsub = null;

  function render() {
    const state = getState();
    const { uid, roomCode, room } = state;

    if (!room) return;

    const players = getPlayers();
    const activePlayers = getActivePlayers();
    const host = isHost();
    const settings = room.settings || {};

    container.innerHTML = '';

    // Header
    renderHeader(container, 'LOBBY', () => leaveRoom());

    // Room code display
    const codeSection = el('div', 'card mb-4 text-center');
    codeSection.innerHTML = `
      <div class="text-xs text-slate-400 uppercase tracking-wider mb-1">Room Code</div>
      <div class="flex items-center justify-center gap-3">
        <span class="text-3xl font-mono font-bold text-cyan-400 tracking-[0.3em]">${roomCode}</span>
        <button id="copyCodeBtn" class="btn-secondary !px-3 !py-1.5 text-xs">Copy</button>
      </div>
    `;
    container.appendChild(codeSection);

    // Copy button handler
    setTimeout(() => {
      const copyBtn = container.querySelector('#copyCodeBtn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => copyToClipboard(roomCode, copyBtn));
      }
    }, 0);

    // Player list with achievement badges
    const playersSection = el('div', 'mb-4');
    const playersTitle = el('div', 'text-sm font-semibold text-slate-300 mb-2', `Players (${activePlayers.length})`);
    playersSection.appendChild(playersTitle);
    renderPlayerList(playersSection, players, room.host);

    // Show own achievements under player list
    if (uid) {
      const ownData = loadAchievements(uid);
      if (ownData.unlocked && ownData.unlocked.length > 0) {
        const badgesDiv = el('div', 'flex flex-wrap gap-1.5 mt-2 pl-4');
        ownData.unlocked.forEach((id) => {
          const ach = ACHIEVEMENTS.find((a) => a.id === id);
          if (ach) badgesDiv.appendChild(renderAchievementBadge(ach));
        });
        playersSection.appendChild(badgesDiv);
      }
    }
    container.appendChild(playersSection);

    // Settings (host only)
    if (host) {
      const settingsSection = el('div', 'card mb-4');
      settingsSection.innerHTML = `
        <div class="text-sm font-semibold text-slate-300 mb-3">Settings</div>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-slate-400 block mb-1">Timer Duration</label>
            <select id="durationSelect" class="input !py-2" ${settings.incidentMode ? 'disabled' : ''}>
              <option value="180" ${settings.durationSec === 180 ? 'selected' : ''}>3 minutes</option>
              <option value="300" ${settings.durationSec === 300 ? 'selected' : ''}>5 minutes</option>
              <option value="480" ${settings.durationSec === 480 ? 'selected' : ''}>8 minutes (default)</option>
              <option value="600" ${settings.durationSec === 600 ? 'selected' : ''}>10 minutes</option>
              <option value="720" ${settings.durationSec === 720 ? 'selected' : ''}>12 minutes</option>
            </select>
            ${settings.incidentMode ? '<div class="text-xs text-slate-500 mt-1">Disabled in Incident Response mode</div>' : ''}
          </div>
          <div>
            <label class="text-xs text-slate-400 block mb-1">Location Pack</label>
            <select id="packSelect" class="input !py-2">
              <option value="all" ${settings.pack === 'all' ? 'selected' : ''}>All (Classic + Tech)</option>
              <option value="classic" ${settings.pack === 'classic' ? 'selected' : ''}>Classic Only</option>
              <option value="tech" ${settings.pack === 'tech' ? 'selected' : ''}>Tech/Security Only</option>
            </select>
          </div>

          <!-- Hacker Mode (Phase 3.1) -->
          <div class="border-t border-slate-700 pt-3">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="hackerModeToggle" ${settings.hackerMode ? 'checked' : ''} class="w-4 h-4 accent-cyan-500" />
              <span class="text-sm text-slate-300">Hacker Mode (Spy gets a hint)</span>
            </label>
            <div id="hackerHintOptions" class="${settings.hackerMode ? '' : 'hidden'} mt-2 pl-6">
              <select id="hintTypeSelect" class="input !py-1.5 text-xs">
                <option value="letter" ${settings.hackerHintType === 'letter' ? 'selected' : ''}>First Letter</option>
                <option value="category" ${settings.hackerHintType === 'category' ? 'selected' : ''}>Category (Pack Name)</option>
              </select>
              ${settings.hackerMode && settings.hackerHintType === 'category' && settings.pack !== 'all'
                ? '<div class="text-xs text-amber-400 mt-1">Warning: category hint is useless when only one pack is selected</div>'
                : ''}
            </div>
          </div>

          <!-- Double Agent (Phase 3.2) -->
          <div class="border-t border-slate-700 pt-3">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="doubleAgentToggle" ${settings.doubleAgent ? 'checked' : ''} class="w-4 h-4 accent-cyan-500" />
              <span class="text-sm text-slate-300">Double Agent (Two Spies)</span>
            </label>
            ${settings.doubleAgent && activePlayers.length < 5
              ? '<div class="text-xs text-amber-400 mt-1 pl-6">Requires 5+ players</div>'
              : ''}
          </div>

          <!-- Incident Response Mode (Phase 3.4) -->
          <div class="border-t border-slate-700 pt-3">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="incidentModeToggle" ${settings.incidentMode ? 'checked' : ''} class="w-4 h-4 accent-cyan-500" />
              <span class="text-sm text-slate-300">Incident Response Mode</span>
            </label>
            <div class="text-xs text-slate-500 mt-1 pl-6">Progress bar replaces timer. Spy exfiltrates data over rounds.</div>
          </div>
        </div>
      `;
      container.appendChild(settingsSection);

      // Settings change handlers
      setTimeout(() => {
        const durSelect = container.querySelector('#durationSelect');
        const packSelect = container.querySelector('#packSelect');
        const hackerToggle = container.querySelector('#hackerModeToggle');
        const hintTypeSelect = container.querySelector('#hintTypeSelect');
        const doubleAgentToggle = container.querySelector('#doubleAgentToggle');
        const incidentToggle = container.querySelector('#incidentModeToggle');

        if (durSelect) {
          durSelect.addEventListener('change', () => {
            updateSettings({ durationSec: parseInt(durSelect.value) });
          });
        }
        if (packSelect) {
          packSelect.addEventListener('change', () => {
            updateSettings({ pack: packSelect.value });
          });
        }
        if (hackerToggle) {
          hackerToggle.addEventListener('change', () => {
            updateSettings({ hackerMode: hackerToggle.checked });
          });
        }
        if (hintTypeSelect) {
          hintTypeSelect.addEventListener('change', () => {
            updateSettings({ hackerHintType: hintTypeSelect.value });
          });
        }
        if (doubleAgentToggle) {
          doubleAgentToggle.addEventListener('change', () => {
            updateSettings({ doubleAgent: doubleAgentToggle.checked });
          });
        }
        if (incidentToggle) {
          incidentToggle.addEventListener('change', () => {
            updateSettings({ incidentMode: incidentToggle.checked });
          });
        }
      }, 0);

      // Custom Locations section (Phase 3.3)
      const customSection = el('div', 'card mb-4');
      customSection.innerHTML = `
        <div class="text-sm font-semibold text-slate-300 mb-3">Custom Locations</div>
      `;

      // List existing custom locations
      const customLocs = room.customLocations ? Object.entries(room.customLocations) : [];
      if (customLocs.length > 0) {
        const list = el('div', 'space-y-1.5 mb-3');
        customLocs.forEach(([key, loc]) => {
          const row = el('div', 'flex items-center justify-between px-3 py-1.5 rounded bg-slate-700/30 text-sm');
          row.innerHTML = `<span class="text-slate-300">${sanitize(loc.name)}</span>`;
          const removeBtn = el('button', 'text-xs text-rose-400 hover:text-rose-300 cursor-pointer', 'Remove');
          removeBtn.addEventListener('click', () => removeCustomLocation(key));
          row.appendChild(removeBtn);
          list.appendChild(row);
        });
        customSection.appendChild(list);
      }

      // Add form (if under cap of 20)
      if (customLocs.length < 20) {
        const addForm = el('div', 'space-y-2');
        addForm.innerHTML = `
          <input type="text" id="customLocName" class="input !py-1.5 text-sm" placeholder="Location name" maxlength="40" />
          <input type="text" id="customLocRoles" class="input !py-1.5 text-xs" placeholder="8 roles (comma-separated)" />
        `;
        const addBtn = el('button', 'btn-secondary w-full text-xs !py-1.5', 'Add Location');
        addForm.appendChild(addBtn);
        customSection.appendChild(addForm);

        setTimeout(() => {
          const nameInput = container.querySelector('#customLocName');
          const rolesInput = container.querySelector('#customLocRoles');
          if (addBtn && nameInput && rolesInput) {
            addBtn.addEventListener('click', async () => {
              const name = nameInput.value.trim();
              const rolesStr = rolesInput.value.trim();
              if (!name) {
                showError(container, 'Enter a location name');
                return;
              }
              const roles = rolesStr.split(',').map((r) => r.trim()).filter(Boolean);
              if (roles.length < 1) {
                // Auto-generate generic roles if none provided
                const defaultRoles = ['Employee', 'Manager', 'Security', 'Visitor', 'Technician', 'Intern', 'Director', 'Consultant'];
                await addCustomLocation({ name, roles: defaultRoles });
              } else {
                // Pad to 8 roles if needed
                while (roles.length < 8) roles.push(`Role ${roles.length + 1}`);
                await addCustomLocation({ name, roles: roles.slice(0, 8) });
              }
              nameInput.value = '';
              rolesInput.value = '';
            });
          }
        }, 0);
      } else {
        const cap = el('div', 'text-xs text-slate-500', 'Maximum 20 custom locations reached.');
        customSection.appendChild(cap);
      }

      container.appendChild(customSection);

    } else {
      // Non-host: show current settings
      const packLabel = settings.pack === 'all' ? 'All' : settings.pack === 'classic' ? 'Classic' : 'Tech';
      const durLabel = settings.incidentMode ? 'Incident Mode' : `${Math.floor(settings.durationSec / 60)} min`;
      const infoSection = el('div', 'card mb-4 text-sm text-slate-400');
      let infoHTML = `
        <div class="flex justify-between"><span>Timer:</span><span class="text-slate-200">${durLabel}</span></div>
        <div class="flex justify-between mt-1"><span>Locations:</span><span class="text-slate-200">${packLabel}</span></div>
      `;
      if (settings.hackerMode) {
        infoHTML += `<div class="flex justify-between mt-1"><span>Hacker Mode:</span><span class="text-cyan-400">ON (${settings.hackerHintType || 'letter'})</span></div>`;
      }
      if (settings.doubleAgent) {
        infoHTML += `<div class="flex justify-between mt-1"><span>Double Agent:</span><span class="text-cyan-400">ON</span></div>`;
      }
      if (settings.incidentMode) {
        infoHTML += `<div class="flex justify-between mt-1"><span>Incident Response:</span><span class="text-cyan-400">ON</span></div>`;
      }
      infoSection.innerHTML = infoHTML;
      container.appendChild(infoSection);
    }

    // Start / waiting
    const footer = el('div', 'mt-auto pt-4');
    if (host) {
      const minPlayers = settings.doubleAgent ? 5 : 3;
      const canStart = activePlayers.length >= minPlayers;
      const startBtn = el('button', `btn-primary w-full ${!canStart ? 'opacity-50 cursor-not-allowed' : ''}`,
        canStart ? 'Start Game' : `Need ${minPlayers - activePlayers.length} more player${minPlayers - activePlayers.length === 1 ? '' : 's'}`
      );
      startBtn.disabled = !canStart;
      startBtn.addEventListener('click', async () => {
        if (!canStart) return;
        startBtn.disabled = true;
        startBtn.textContent = 'Starting...';
        try {
          await startGame();
        } catch (err) {
          showError(container, err.message);
          startBtn.disabled = false;
          startBtn.textContent = 'Start Game';
        }
      });
      footer.appendChild(startBtn);
    } else {
      const waiting = el('div', 'text-center text-slate-400 text-sm py-3', 'Waiting for host to start the game...');
      footer.appendChild(waiting);
    }
    container.appendChild(footer);
  }

  render();
  unsub = subscribe(render);

  return () => {
    if (unsub) unsub();
  };
}
