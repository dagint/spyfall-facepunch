import './styles.css';
import { initAuth } from './firebase.js';
import { setState } from './game/state.js';
import { register, startRouter } from './router.js';
import { renderHome } from './ui/screens/home.js';
import { renderLobby } from './ui/screens/lobby.js';
import { renderGame } from './ui/screens/game.js';
import { renderResults } from './ui/screens/results.js';
import { renderRules } from './ui/screens/rules.js';
import { renderAdmin } from './ui/screens/admin.js';
import { listenToRoom } from './game/listeners.js';
import { applyTheme } from './ui/theme.js';
import { initAudio } from './audio/sounds.js';

// Register routes
register('home', renderHome);
register('lobby', renderLobby);
register('game', renderGame);
register('results', renderResults);
register('rules', renderRules);
register('admin', renderAdmin);

// Initialize app
async function init() {
  // Apply saved theme
  applyTheme();

  // Initialize audio system
  initAudio();

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="text-2xl font-mono font-bold text-cyan-400 mb-2">SPYFALL</div>
        <div class="text-sm text-slate-400">Connecting...</div>
      </div>
    </div>
  `;

  try {
    const uid = await initAuth();
    setState({ uid });

    // Check if returning to an active room
    const savedRoom = sessionStorage.getItem('spyfall_room');
    if (savedRoom) {
      const { roomCode } = JSON.parse(savedRoom);
      setState({ roomCode });
      listenToRoom(roomCode);
    }

    startRouter();
  } catch (err) {
    app.innerHTML = `
      <div class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <div class="text-2xl font-mono font-bold text-rose-400 mb-2">Connection Failed</div>
          <div class="text-sm text-slate-400 mb-4">${err.message}</div>
          <button onclick="location.reload()" class="btn-primary">Retry</button>
        </div>
      </div>
    `;
  }
}

init();
