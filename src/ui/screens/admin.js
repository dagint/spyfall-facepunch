import { el, sanitize, showError } from '../components.js';
import {
  db, ref, onValue, query, orderByChild, limitToLast, endBefore, get, update,
  isAdminEmail, signInWithGoogle, signOutAdmin, getCurrentEmail,
} from '../../firebase.js';
import { navigate } from '../../router.js';
import { iconBarChart, iconPercent, iconClock, iconUsers, iconFolder, iconTrophy, iconHistory as iconHistoryIcon, iconLock } from '../icons.js';
import { cleanupOldRooms } from '../../game/actions.js';

/** Render the admin dashboard (rooms, history, stats, leaderboard). */
export function renderAdmin(container) {
  const unsubs = [];
  let historyData = [];
  let roomsData = {};
  let activeTab = 'rooms';
  let filterEmail = 'all';
  let leaderboardPage = 0;
  const PAGE_SIZE = 20;

  function cleanup() {
    unsubs.forEach((fn) => fn());
  }

  // Auth gate
  const email = getCurrentEmail();
  if (!email || !isAdminEmail(email)) {
    container.innerHTML = '';
    const wrapper = el('div', 'flex-1 flex flex-col items-center justify-center text-center');
    wrapper.innerHTML = `
      <div class="text-cyan-400 mb-4 opacity-60">${iconLock(48)}</div>
      <div class="text-2xl font-mono font-bold text-cyan-400 mb-2">ADMIN ACCESS</div>
      <div class="text-sm text-slate-400 mb-6">Sign in with a Gmail admin account</div>
    `;
    const signInBtn = el('button', 'btn-primary mb-4', 'Sign in with Google');
    signInBtn.addEventListener('click', async () => {
      signInBtn.disabled = true;
      signInBtn.textContent = 'Signing in...';
      try {
        const user = await signInWithGoogle();
        if (!isAdminEmail(user.email)) {
          showError(wrapper, 'Access denied — your email is not in the admin list.');
          await signOutAdmin();
          signInBtn.disabled = false;
          signInBtn.textContent = 'Sign in with Google';
          return;
        }
        renderAdmin(container);
      } catch (err) {
        showError(wrapper, err.message);
        signInBtn.disabled = false;
        signInBtn.textContent = 'Sign in with Google';
      }
    });
    wrapper.appendChild(signInBtn);

    const backBtn = el('button', 'btn-secondary', 'Back to Home');
    backBtn.addEventListener('click', () => navigate('home'));
    wrapper.appendChild(backBtn);

    container.appendChild(wrapper);
    return cleanup;
  }

  // Override container width for dashboard
  const app = document.getElementById('app');
  const originalMaxWidth = app.style.maxWidth;
  app.style.maxWidth = '64rem';

  function restoreWidth() {
    app.style.maxWidth = originalMaxWidth;
  }

  // Header
  container.innerHTML = '';
  const headerRow = el('div', 'flex items-center justify-between mb-4');
  const left = el('div', 'flex items-center gap-3');
  const backBtn = el('button', 'btn-secondary !px-3 !py-2 text-xs', 'Home');
  backBtn.addEventListener('click', () => navigate('home'));
  left.appendChild(backBtn);
  left.appendChild(el('h1', 'text-xl font-bold text-cyan-400 font-mono', 'ADMIN DASHBOARD'));
  headerRow.appendChild(left);

  const right = el('div', 'flex items-center gap-3');
  right.appendChild(el('span', 'text-xs text-emerald-400 font-mono', sanitize(email)));
  const signOutBtn = el('button', 'text-xs text-slate-500 hover:text-slate-300 underline cursor-pointer', 'Sign Out');
  signOutBtn.addEventListener('click', async () => {
    await signOutAdmin();
    navigate('home');
  });
  right.appendChild(signOutBtn);
  headerRow.appendChild(right);
  container.appendChild(headerRow);

  // Tabs
  const tabs = el('div', 'flex gap-1 mb-4 border-b border-slate-700');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Admin dashboard tabs');
  const tabDefs = [
    { id: 'rooms', label: 'Active Rooms' },
    { id: 'history', label: 'Game History' },
    { id: 'stats', label: 'Stats' },
    { id: 'leaderboard', label: 'Leaderboard' },
  ];
  const tabButtons = {};
  tabDefs.forEach((t) => {
    const btn = el('button', 'px-4 py-2 text-sm font-mono cursor-pointer transition-colors', t.label);
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', String(t.id === activeTab));
    btn.setAttribute('aria-controls', 'admin-tab-content');
    btn.id = `tab-${t.id}`;
    btn.addEventListener('click', () => {
      activeTab = t.id;
      updateTabStyles();
      renderTabContent();
    });
    tabButtons[t.id] = btn;
    tabs.appendChild(btn);
  });
  container.appendChild(tabs);

  function updateTabStyles() {
    Object.entries(tabButtons).forEach(([id, btn]) => {
      const isActive = id === activeTab;
      btn.setAttribute('aria-selected', String(isActive));
      if (isActive) {
        btn.className = 'px-4 py-2 text-sm font-mono cursor-pointer text-cyan-400 border-b-2 border-cyan-400 -mb-px';
      } else {
        btn.className = 'px-4 py-2 text-sm font-mono cursor-pointer text-slate-400 hover:text-slate-200 transition-colors';
      }
    });
  }
  updateTabStyles();

  // Content area
  const content = el('div', '');
  content.id = 'admin-tab-content';
  content.setAttribute('role', 'tabpanel');
  content.setAttribute('aria-labelledby', `tab-${activeTab}`);
  container.appendChild(content);

  function filteredHistory() {
    if (filterEmail === 'all') return historyData;
    return historyData.filter((g) => g.hostedByEmail === filterEmail);
  }

  function renderPager(page, totalItems, onPageChange) {
    const totalPages = Math.ceil(totalItems / PAGE_SIZE);
    if (totalPages <= 1) return null;
    const wrap = el('div', 'flex items-center justify-between mt-4 pt-3 border-t border-slate-700/50');
    const info = el('span', 'text-xs text-slate-500 font-mono');
    info.textContent = `Page ${page + 1} of ${totalPages} (${totalItems} total)`;
    const btns = el('div', 'flex gap-2');
    const prev = el('button', 'btn-secondary !px-3 !py-1 text-xs', 'Prev');
    prev.disabled = page === 0;
    prev.addEventListener('click', () => onPageChange(page - 1));
    const next = el('button', 'btn-secondary !px-3 !py-1 text-xs', 'Next');
    next.disabled = page >= totalPages - 1;
    next.addEventListener('click', () => onPageChange(page + 1));
    btns.append(prev, next);
    wrap.append(info, btns);
    return wrap;
  }

  function renderFilter() {
    const adminEmails = [...new Set(historyData.map((g) => g.hostedByEmail).filter(Boolean))].sort();
    if (adminEmails.length <= 1) return null;

    const wrap = el('div', 'flex items-center gap-2 mb-4');
    wrap.innerHTML = `<span class="text-xs text-slate-500 font-mono">Host:</span>`;
    const select = el('select', 'input !py-1.5 !px-2 text-xs w-auto');
    select.innerHTML = `<option value="all">All Admins</option>` +
      adminEmails.map((e) => `<option value="${sanitize(e)}" ${filterEmail === e ? 'selected' : ''}>${sanitize(e)}</option>`).join('');
    select.addEventListener('change', () => {
      filterEmail = select.value;
      leaderboardPage = 0;
      renderTabContent();
    });
    wrap.appendChild(select);
    return wrap;
  }

  async function renderTabContent() {
    content.innerHTML = '';
    content.setAttribute('aria-labelledby', `tab-${activeTab}`);

    if (activeTab !== 'rooms') {
      await ensureHistoryLoaded();
      const filter = renderFilter();
      if (filter) content.appendChild(filter);
    }
    if (activeTab === 'rooms') renderRooms();
    else if (activeTab === 'history') renderHistory();
    else if (activeTab === 'stats') renderStats();
    else if (activeTab === 'leaderboard') renderLeaderboard();
  }

  // ===== Active Rooms =====
  function renderRooms() {
    // Cleanup button
    const cleanupRow = el('div', 'flex justify-end mb-3');
    const cleanupBtn = el('button', 'btn-secondary !px-3 !py-1.5 text-xs', 'Clean up old rooms');
    cleanupBtn.addEventListener('click', async () => {
      cleanupBtn.disabled = true;
      cleanupBtn.textContent = 'Cleaning...';
      await cleanupOldRooms();
      cleanupBtn.textContent = 'Done';
      setTimeout(() => { cleanupBtn.disabled = false; cleanupBtn.textContent = 'Clean up old rooms'; }, 2000);
    });
    cleanupRow.appendChild(cleanupBtn);
    content.appendChild(cleanupRow);

    const rooms = Object.entries(roomsData);
    if (rooms.length === 0) {
      const empty = el('div', 'text-center py-12');
      empty.innerHTML = `<div class="text-slate-600 mb-3 flex justify-center">${iconFolder(48)}</div><div class="text-slate-500 text-sm">No active rooms</div>`;
      content.appendChild(empty);
      return;
    }

    const table = el('div', 'space-y-2');
    const headerRow = el('div', 'grid grid-cols-6 gap-2 px-4 py-2 text-xs text-slate-500 uppercase tracking-wider font-mono');
    headerRow.innerHTML = '<span>Code</span><span>Phase</span><span>Players</span><span>Host</span><span>Created</span><span></span>';
    table.appendChild(headerRow);

    rooms.forEach(([code, room]) => {
      const playerCount = room.players ? Object.keys(room.players).length : 0;
      const hostUid = room.host;
      const hostName = room.players?.[hostUid]?.name || 'Unknown';
      const phase = room.phase || 'unknown';
      const createdAt = room.createdAt ? relativeTime(room.createdAt) : '—';
      const isAdminRoom = !!room.hostedByAdmin;
      const phaseColors = { lobby: 'text-amber-400', playing: 'text-emerald-400', results: 'text-cyan-400' };

      const row = el('div', 'grid grid-cols-6 gap-2 px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700/50 text-sm items-center');
      row.innerHTML = `
        <span class="font-mono font-bold text-cyan-400">${sanitize(code)}</span>
        <span class="font-mono ${phaseColors[phase] || 'text-slate-400'}">${sanitize(phase)}</span>
        <span class="text-slate-300">${playerCount}</span>
        <span class="text-slate-300 truncate">${sanitize(hostName)}${isAdminRoom ? ' <span class="text-emerald-500 text-xs">admin</span>' : ''}</span>
        <span class="text-slate-500 text-xs">${createdAt}</span>
        <span></span>
      `;

      const deleteBtn = el('button', 'text-xs text-rose-500 hover:text-rose-400 cursor-pointer font-mono', 'Delete');
      deleteBtn.addEventListener('click', async () => {
        if (!confirm(`Delete room ${code}?`)) return;
        deleteBtn.disabled = true;
        deleteBtn.textContent = '...';
        try {
          await update(ref(db), {
            [`rooms/${code}`]: null,
            [`roomSecrets/${code}`]: null,
            [`playerRoles/${code}`]: null,
          });
        } catch (err) {
          showError(content, `Failed to delete ${code}: ${err.message}`);
          deleteBtn.disabled = false;
          deleteBtn.textContent = 'Delete';
        }
      });
      row.lastElementChild.appendChild(deleteBtn);
      table.appendChild(row);
    });
    content.appendChild(table);
  }

  // ===== Game History =====
  function renderHistory() {
    const historyData = filteredHistory();
    if (historyData.length === 0) {
      const empty = el('div', 'text-center py-12');
      empty.innerHTML = `<div class="text-slate-600 mb-3 flex justify-center">${iconHistoryIcon(48)}</div><div class="text-slate-500 text-sm">No games recorded yet</div>`;
      content.appendChild(empty);
      return;
    }

    // historyData is already in descending order from loadHistoryPage
    historyData.forEach((game) => {
      const card = el('div', 'card mb-3');
      const winner = game.result?.winner || 'unknown';
      const winnerColor = winner === 'spy' ? 'text-rose-400' : 'text-emerald-400';
      const winnerLabel = winner === 'spy' ? 'Spy Won' : 'Players Won';
      const duration = game.durationMs ? formatDuration(game.durationMs) : '—';
      const date = game.completedAt ? new Date(game.completedAt).toLocaleString() : '—';
      const resultType = game.result?.type || 'unknown';

      // Header
      card.innerHTML = `
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-3">
            <span class="font-mono font-bold text-cyan-400">${sanitize(game.roomCode || '—')}</span>
            <span class="text-xs px-2 py-0.5 rounded-full ${winnerColor} bg-slate-700/50 font-mono">${winnerLabel}</span>
            <span class="text-xs text-slate-500 font-mono">${sanitize(resultType)}</span>
          </div>
          <span class="text-xs text-slate-500">${date}</span>
        </div>
      `;

      // Details grid
      const details = el('div', 'grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-3');
      details.innerHTML = `
        <div><span class="text-slate-500">Location:</span> <span class="text-slate-200">${sanitize(game.location || '—')}</span></div>
        <div><span class="text-slate-500">Duration:</span> <span class="text-slate-200">${duration}</span></div>
        <div><span class="text-slate-500">Players:</span> <span class="text-slate-200">${game.playerCount || 0}</span></div>
        <div><span class="text-slate-500">Pack:</span> <span class="text-slate-200">${sanitize(game.locationPack || '—')}</span></div>
      `;

      // Settings badges
      const settings = game.settings || {};
      if (settings.hackerMode || settings.doubleAgent || settings.incidentMode) {
        const badges = el('div', 'flex gap-2 mb-3');
        if (settings.hackerMode) badges.appendChild(modeBadge('HACKER', 'text-amber-400'));
        if (settings.doubleAgent) badges.appendChild(modeBadge('DOUBLE AGENT', 'text-rose-400'));
        if (settings.incidentMode) badges.appendChild(modeBadge('INCIDENT', 'text-cyan-400'));
        details.appendChild(badges);
      }
      card.appendChild(details);

      // Player list (collapsible)
      if (game.players) {
        const toggle = el('button', 'text-xs text-slate-500 hover:text-slate-300 cursor-pointer font-mono underline', 'Show Players');
        const playerList = el('div', 'mt-2 space-y-1 hidden');

        Object.entries(game.players).forEach(([_uid, p]) => {
          const isSpy = p.wasSpy;
          const row = el('div', `flex items-center justify-between px-3 py-1.5 rounded text-xs ${isSpy ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-700/30 text-slate-300'}`);
          const nameStr = p.codename ? `${p.codename} // ${p.name}` : p.name;
          row.innerHTML = `
            <span class="font-mono">${sanitize(nameStr)}</span>
            <span class="font-mono">${isSpy ? 'SPY' : sanitize(p.role || '—')}</span>
          `;
          playerList.appendChild(row);
        });

        toggle.addEventListener('click', () => {
          const hidden = playerList.classList.contains('hidden');
          playerList.classList.toggle('hidden');
          toggle.textContent = hidden ? 'Hide Players' : 'Show Players';
        });
        card.appendChild(toggle);
        card.appendChild(playerList);
      }

      // Events timeline (collapsible)
      if (game.events && game.events.length > 0) {
        const evtToggle = el('button', 'text-xs text-slate-500 hover:text-slate-300 cursor-pointer font-mono underline ml-3', 'Show Timeline');
        const evtList = el('div', 'mt-2 space-y-1 hidden');

        game.events.forEach((evt) => {
          const elapsedSec = game.startedAt ? Math.floor((evt.ts - game.startedAt) / 1000) : 0;
          const mins = Math.floor(elapsedSec / 60);
          const secs = elapsedSec % 60;
          const timeStr = `T+${mins}:${secs.toString().padStart(2, '0')}`;

          const playerName = (uid) => {
            const p = game.players?.[uid];
            return p ? (p.codename ? `${p.codename} // ${p.name}` : p.name) : 'Unknown';
          };

          let desc = evt.type;
          if (evt.type === 'vote') desc = `${playerName(evt.actor)} voted for ${playerName(evt.target)}`;
          else if (evt.type === 'spy_guess') desc = `${playerName(evt.actor)} guessed "${evt.guessedLocation || '?'}"`;
          else if (evt.type === 'majority') desc = `Majority reached against ${playerName(evt.target)}`;
          else if (evt.type === 'timeout') desc = 'Time expired';

          const evtRow = el('div', 'flex items-center gap-2 text-xs px-3 py-1');
          evtRow.innerHTML = `<span class="font-mono text-slate-500">${timeStr}</span><span class="text-slate-300">${sanitize(desc)}</span>`;
          evtList.appendChild(evtRow);
        });

        evtToggle.addEventListener('click', () => {
          const hidden = evtList.classList.contains('hidden');
          evtList.classList.toggle('hidden');
          evtToggle.textContent = hidden ? 'Hide Timeline' : 'Show Timeline';
        });
        card.appendChild(evtToggle);
        card.appendChild(evtList);
      }

      content.appendChild(card);
    });

    if (historyHasMore) {
      const loadMoreBtn = el('button', 'btn-secondary w-full mt-4 text-sm', 'Load More');
      loadMoreBtn.addEventListener('click', async () => {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = 'Loading...';
        await loadHistoryPage();
        renderTabContent();
      });
      content.appendChild(loadMoreBtn);
    } else if (historyData.length > 0) {
      const endMsg = el('div', 'text-center text-xs text-slate-500 mt-4 font-mono', `${historyData.length} games loaded`);
      content.appendChild(endMsg);
    }
  }

  // ===== Stats =====
  function renderStats() {
    const historyData = filteredHistory();
    if (historyData.length === 0) {
      const empty = el('div', 'text-center py-12');
      empty.innerHTML = `<div class="text-slate-600 mb-3 flex justify-center">${iconBarChart(48)}</div><div class="text-slate-500 text-sm">No data yet</div>`;
      content.appendChild(empty);
      return;
    }

    const total = historyData.length;
    const spyWins = historyData.filter((g) => g.result?.winner === 'spy').length;
    const playerWins = total - spyWins;
    const avgDuration = historyData.reduce((s, g) => s + (g.durationMs || 0), 0) / total;

    // Result type breakdown
    const byType = {};
    historyData.forEach((g) => {
      const t = g.result?.type || 'unknown';
      byType[t] = (byType[t] || 0) + 1;
    });

    // Location frequency
    const byLocation = {};
    historyData.forEach((g) => {
      const loc = g.location || 'Unknown';
      byLocation[loc] = (byLocation[loc] || 0) + 1;
    });
    const topLocations = Object.entries(byLocation).sort((a, b) => b[1] - a[1]).slice(0, 10);

    // Games per day
    const byDay = {};
    historyData.forEach((g) => {
      if (!g.completedAt) return;
      const day = new Date(g.completedAt).toLocaleDateString();
      byDay[day] = (byDay[day] || 0) + 1;
    });

    const grid = el('div', 'grid grid-cols-2 gap-4 mb-6');

    grid.appendChild(statCard('Total Games', total, 'text-cyan-400', iconBarChart(20)));
    grid.appendChild(statCard('Spy Win Rate', `${total > 0 ? Math.round((spyWins / total) * 100) : 0}%`, 'text-rose-400', iconPercent(20)));
    grid.appendChild(statCard('Player Win Rate', `${total > 0 ? Math.round((playerWins / total) * 100) : 0}%`, 'text-emerald-400', iconUsers(20)));
    grid.appendChild(statCard('Avg Duration', formatDuration(avgDuration), 'text-amber-400', iconClock(20)));

    content.appendChild(grid);

    // Result type breakdown
    const typeCard = el('div', 'card mb-4');
    typeCard.innerHTML = `<div class="text-sm font-semibold text-slate-300 mb-3 font-mono">Win Conditions</div>`;
    const typeList = el('div', 'space-y-2');
    Object.entries(byType).forEach(([type, count]) => {
      const pct = Math.round((count / total) * 100);
      const row = el('div', 'flex items-center justify-between text-sm');
      row.innerHTML = `
        <span class="text-slate-300 font-mono">${sanitize(type)}</span>
        <div class="flex items-center gap-2">
          <div class="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div class="h-full bg-cyan-500 rounded-full" style="width: ${pct}%"></div>
          </div>
          <span class="text-slate-400 text-xs w-12 text-right">${count} (${pct}%)</span>
        </div>
      `;
      typeList.appendChild(row);
    });
    typeCard.appendChild(typeList);
    content.appendChild(typeCard);

    // Top locations
    const locCard = el('div', 'card mb-4');
    locCard.innerHTML = `<div class="text-sm font-semibold text-slate-300 mb-3 font-mono">Top Locations</div>`;
    const locList = el('div', 'space-y-1');
    topLocations.forEach(([loc, count], i) => {
      const row = el('div', 'flex items-center justify-between text-sm px-2 py-1');
      row.innerHTML = `
        <span class="text-slate-300">${i + 1}. ${sanitize(loc)}</span>
        <span class="text-slate-500 font-mono text-xs">${count} game${count !== 1 ? 's' : ''}</span>
      `;
      locList.appendChild(row);
    });
    locCard.appendChild(locList);
    content.appendChild(locCard);

    // Games per day
    if (Object.keys(byDay).length > 0) {
      const dayCard = el('div', 'card mb-4');
      dayCard.innerHTML = `<div class="text-sm font-semibold text-slate-300 mb-3 font-mono">Games Per Day</div>`;
      const dayList = el('div', 'space-y-1');
      Object.entries(byDay).sort((a, b) => new Date(b[0]) - new Date(a[0])).forEach(([day, count]) => {
        const row = el('div', 'flex items-center justify-between text-sm px-2 py-1');
        row.innerHTML = `
          <span class="text-slate-400">${day}</span>
          <span class="text-cyan-400 font-mono">${count}</span>
        `;
        dayList.appendChild(row);
      });
      dayCard.appendChild(dayList);
      content.appendChild(dayCard);
    }
  }

  // ===== Leaderboard =====
  function renderLeaderboard() {
    const historyData = filteredHistory();
    if (historyData.length === 0) {
      const empty = el('div', 'text-center py-12');
      empty.innerHTML = `<div class="text-slate-600 mb-3 flex justify-center">${iconTrophy(48)}</div><div class="text-slate-500 text-sm">No data yet</div>`;
      content.appendChild(empty);
      return;
    }

    // Aggregate by player name (best we can do with anonymous auth)
    const playerStats = {};
    historyData.forEach((game) => {
      if (!game.players) return;
      const winner = game.result?.winner;
      Object.entries(game.players).forEach(([_uid, p]) => {
        const name = (p.name || 'Unknown').trim().toLowerCase();
        if (!playerStats[name]) {
          playerStats[name] = { displayName: p.name, games: 0, spyGames: 0, spyWins: 0, playerWins: 0 };
        }
        const s = playerStats[name];
        s.games++;
        if (p.wasSpy) {
          s.spyGames++;
          if (winner === 'spy') s.spyWins++;
        } else {
          if (winner === 'players') s.playerWins++;
        }
      });
    });

    const sorted = Object.values(playerStats).sort((a, b) => b.games - a.games);
    const pageItems = sorted.slice(leaderboardPage * PAGE_SIZE, (leaderboardPage + 1) * PAGE_SIZE);

    const table = el('div', 'space-y-1');

    // Header
    const headerRow = el('div', 'grid grid-cols-6 gap-2 px-4 py-2 text-xs text-slate-500 uppercase tracking-wider font-mono');
    headerRow.innerHTML = '<span>Player</span><span class="text-center">Games</span><span class="text-center">As Spy</span><span class="text-center">Spy Win%</span><span class="text-center">Player Win%</span><span class="text-center">Overall Win%</span>';
    table.appendChild(headerRow);

    pageItems.forEach((s) => {
      const spyWinPct = s.spyGames > 0 ? Math.round((s.spyWins / s.spyGames) * 100) : 0;
      const nonSpyGames = s.games - s.spyGames;
      const playerWinPct = nonSpyGames > 0 ? Math.round((s.playerWins / nonSpyGames) * 100) : 0;
      const totalWins = s.spyWins + s.playerWins;
      const overallPct = s.games > 0 ? Math.round((totalWins / s.games) * 100) : 0;

      const row = el('div', 'grid grid-cols-6 gap-2 px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-sm');
      row.innerHTML = `
        <span class="text-slate-200 font-medium truncate">${sanitize(s.displayName)}</span>
        <span class="text-center text-slate-300">${s.games}</span>
        <span class="text-center text-slate-400">${s.spyGames}</span>
        <span class="text-center ${spyWinPct >= 50 ? 'text-rose-400' : 'text-slate-400'}">${spyWinPct}%</span>
        <span class="text-center ${playerWinPct >= 50 ? 'text-emerald-400' : 'text-slate-400'}">${playerWinPct}%</span>
        <span class="text-center font-mono ${overallPct >= 50 ? 'text-cyan-400' : 'text-slate-400'}">${overallPct}%</span>
      `;
      table.appendChild(row);
    });
    content.appendChild(table);

    const pager = renderPager(leaderboardPage, sorted.length, (p) => { leaderboardPage = p; renderTabContent(); });
    if (pager) content.appendChild(pager);
  }

  // ===== Firebase listeners =====

  // Listen to active rooms
  const roomsRef = ref(db, 'rooms');
  const roomsUnsub = onValue(roomsRef, (snap) => {
    roomsData = snap.val() || {};
    if (activeTab === 'rooms') renderTabContent();
  });
  unsubs.push(roomsUnsub);

  // Fetch game history on demand (paginated)
  let historyLoaded = false;
  let historyHasMore = true;
  let historyOldestTs = null;
  let historyLoading = false;

  async function loadHistoryPage(reset = false) {
    if (historyLoading) return;
    historyLoading = true;
    try {
      const constraints = [orderByChild('completedAt'), limitToLast(PAGE_SIZE + 1)];
      if (!reset && historyOldestTs != null) {
        constraints.push(endBefore(historyOldestTs));
      }
      if (reset) {
        historyData = [];
        historyOldestTs = null;
        historyHasMore = true;
      }
      const snap = await get(query(ref(db, 'gameHistory'), ...constraints));
      const val = snap.val();
      const entries = val ? Object.values(val) : [];
      entries.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

      if (entries.length > PAGE_SIZE) {
        historyHasMore = true;
        entries.length = PAGE_SIZE;
      } else {
        historyHasMore = false;
      }

      if (entries.length > 0) {
        historyOldestTs = entries[entries.length - 1].completedAt;
      }
      historyData = [...historyData, ...entries];
      historyLoaded = true;
    } catch (err) {
      console.warn('Failed to load history:', err);
    } finally {
      historyLoading = false;
    }
  }

  async function ensureHistoryLoaded() {
    if (!historyLoaded) await loadHistoryPage(true);
  }

  // Initial render
  renderTabContent();

  return () => {
    cleanup();
    restoreWidth();
  };
}

// ===== Helpers =====

function statCard(label, value, color, iconHtml = '') {
  const card = el('div', 'card text-center');
  card.innerHTML = `
    ${iconHtml ? `<div class="${color} opacity-50 mb-2 flex justify-center">${iconHtml}</div>` : ''}
    <div class="text-xs text-slate-500 uppercase tracking-wider font-mono mb-1">${label}</div>
    <div class="text-2xl font-bold ${color} font-mono">${value}</div>
  `;
  return card;
}

function modeBadge(text, color) {
  const badge = el('span', `text-xs px-2 py-0.5 rounded-full bg-slate-700/50 font-mono ${color}`);
  badge.textContent = text;
  return badge;
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}m ${secs}s`;
}

function relativeTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}
