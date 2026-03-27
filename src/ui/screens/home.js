import { el, showError, sanitize } from '../components.js';
import { createRoom, joinRoom } from '../../game/actions.js';
import { getState, setState } from '../../game/state.js';
import { isValidRoomCode, normalizeRoomCode } from '../../utils/roomCode.js';
import { navigate } from '../../router.js';
import { toggleTheme, getTheme } from '../theme.js';

export function renderHome(container) {
  const savedName = localStorage.getItem('spyfall_name') || '';
  const isTerminal = getTheme() === 'terminal';

  container.innerHTML = `
    <div class="flex-1 flex flex-col items-center justify-center text-center" role="main">
      <div class="absolute top-4 right-4">
        <button id="themeToggle" class="text-xs px-3 py-1.5 rounded border cursor-pointer ${isTerminal ? 'border-green-500 text-green-400 hover:bg-green-500/10' : 'border-slate-600 text-slate-400 hover:text-cyan-400 hover:border-cyan-400'}" title="Toggle terminal theme" aria-label="Toggle terminal theme">
          ${isTerminal ? '> EXIT TERMINAL' : '> TERMINAL'}
        </button>
      </div>

      <div class="mb-8">
        <div class="text-6xl font-mono font-bold text-cyan-400 tracking-tight mb-2">SPYFALL</div>
        <div class="text-slate-400 text-sm">Find the spy. Protect the location.</div>
      </div>

      <div class="w-full max-w-sm space-y-4">
        <div>
          <input
            type="text"
            id="nameInput"
            class="input text-center"
            placeholder="Your name"
            maxlength="20"
            value="${sanitize(savedName)}"
            autocomplete="off"
          />
        </div>

        <button id="createBtn" class="btn-primary w-full">Create Room</button>

        <div class="flex gap-2">
          <input
            type="text"
            id="codeInput"
            class="input text-center uppercase font-mono tracking-widest"
            placeholder="ROOM CODE"
            maxlength="4"
            autocomplete="off"
          />
          <button id="joinBtn" class="btn-primary whitespace-nowrap">Join</button>
        </div>
      </div>

      <button id="rulesBtn" class="mt-8 text-sm text-slate-400 hover:text-cyan-400 transition-colors underline underline-offset-4 cursor-pointer">
        How to Play
      </button>
    </div>
  `;

  const nameInput = container.querySelector('#nameInput');
  const codeInput = container.querySelector('#codeInput');
  const createBtn = container.querySelector('#createBtn');
  const joinBtn = container.querySelector('#joinBtn');
  const rulesBtn = container.querySelector('#rulesBtn');
  const themeToggle = container.querySelector('#themeToggle');

  // Auto-uppercase room code
  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  // Theme toggle
  themeToggle.addEventListener('click', () => {
    toggleTheme();
    // Re-render to update button text
    const newTheme = getTheme();
    themeToggle.textContent = newTheme === 'terminal' ? '> EXIT TERMINAL' : '> TERMINAL';
    themeToggle.className = `text-xs px-3 py-1.5 rounded border cursor-pointer ${newTheme === 'terminal' ? 'border-green-500 text-green-400 hover:bg-green-500/10' : 'border-slate-600 text-slate-400 hover:text-cyan-400 hover:border-cyan-400'}`;
  });

  createBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) {
      showError(container, 'Please enter your name');
      nameInput.focus();
      return;
    }
    localStorage.setItem('spyfall_name', name);
    createBtn.disabled = true;
    createBtn.textContent = 'Creating...';
    try {
      await createRoom(name);
    } catch (err) {
      showError(container, err.message);
      createBtn.disabled = false;
      createBtn.textContent = 'Create Room';
    }
  });

  joinBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) {
      showError(container, 'Please enter your name');
      nameInput.focus();
      return;
    }
    const code = normalizeRoomCode(codeInput.value);
    if (!isValidRoomCode(code)) {
      showError(container, 'Enter a valid 4-character room code');
      codeInput.focus();
      return;
    }
    localStorage.setItem('spyfall_name', name);
    joinBtn.disabled = true;
    joinBtn.textContent = 'Joining...';
    try {
      await joinRoom(code, name);
    } catch (err) {
      showError(container, err.message);
      joinBtn.disabled = false;
      joinBtn.textContent = 'Join';
    }
  });

  rulesBtn.addEventListener('click', () => navigate('rules'));
}
