import { el, showError, sanitize } from '../components.js';
import { createRoom, joinRoom } from '../../game/actions.js';
import { isValidRoomCode, normalizeRoomCode } from '../../utils/roomCode.js';
import { navigate } from '../../router.js';
import { toggleTheme, getTheme } from '../theme.js';
import { isCurrentUserAdmin, signInWithGoogle, signOutAdmin, getCurrentEmail } from '../../firebase.js';
import { STORAGE_KEYS } from '../../constants.js';
import { iconCrosshair } from '../icons.js';

/** Render the home screen (name input, room code, sign-in). */
export function renderHome(container) {
  const savedName = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME) || '';
  const isTerminal = getTheme() === 'terminal';
  const isAdmin = isCurrentUserAdmin();
  const email = getCurrentEmail();

  container.innerHTML = `
    <div class="flex-1 flex flex-col items-center justify-center text-center">
      <div class="absolute top-4 right-4 flex items-center gap-2">
        <button id="themeToggle" class="text-xs px-3 py-1.5 rounded border cursor-pointer ${isTerminal ? 'border-green-500 text-green-400 hover:bg-green-500/10' : 'border-slate-600 text-slate-400 hover:text-cyan-400 hover:border-cyan-400'}" title="Toggle terminal theme" aria-label="Toggle terminal theme">
          ${isTerminal ? '> EXIT TERMINAL' : '> TERMINAL'}
        </button>
      </div>

      <div class="mb-8">
        <div class="text-cyan-400 mb-4 opacity-80">${iconCrosshair(80)}</div>
        <div class="text-6xl font-mono font-bold text-cyan-400 tracking-tight mb-2">SPYFALL</div>
        <div class="text-slate-400 text-sm tracking-wide">Find the spy. Protect the location.</div>
      </div>

      <div class="w-full max-w-sm space-y-4">
        ${isAdmin ? `<div class="text-center text-xs text-emerald-400 font-mono mb-1">ADMIN: ${sanitize(email)} <button id="signOutBtn" class="text-slate-500 hover:text-slate-300 underline cursor-pointer ml-1">sign out</button></div>` : ''}

        <div>
          <label for="nameInput" class="sr-only">Your name</label>
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

        ${isAdmin ? '<button id="createBtn" class="btn-primary w-full">Create Room</button>' : ''}

        <div class="flex gap-2">
          <label for="codeInput" class="sr-only">Room code</label>
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

      <div class="flex flex-col items-center gap-3 mt-8">
        <button id="rulesBtn" class="text-sm text-slate-400 hover:text-cyan-400 transition-colors underline underline-offset-4 cursor-pointer">
          How to Play
        </button>
        <div class="flex items-center gap-4">
          ${isAdmin
            ? '<button id="adminBtn" class="text-xs text-emerald-400 hover:text-emerald-300 transition-colors underline underline-offset-4 cursor-pointer font-mono">Admin Dashboard</button>'
            : '<button id="googleSignIn" class="text-xs text-slate-500 hover:text-slate-400 transition-colors underline underline-offset-4 cursor-pointer">Admin Sign In</button>'
          }
        </div>
      </div>
    </div>
  `;

  const nameInput = container.querySelector('#nameInput');
  const codeInput = container.querySelector('#codeInput');
  const createBtn = container.querySelector('#createBtn');
  const joinBtn = container.querySelector('#joinBtn');
  const rulesBtn = container.querySelector('#rulesBtn');
  const themeToggle = container.querySelector('#themeToggle');
  const googleSignIn = container.querySelector('#googleSignIn');
  const signOutBtn = container.querySelector('#signOutBtn');
  const adminBtn = container.querySelector('#adminBtn');

  // Auto-uppercase room code
  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  // Theme toggle
  themeToggle.addEventListener('click', () => {
    toggleTheme();
    const newTheme = getTheme();
    themeToggle.textContent = newTheme === 'terminal' ? '> EXIT TERMINAL' : '> TERMINAL';
    themeToggle.className = `text-xs px-3 py-1.5 rounded border cursor-pointer ${newTheme === 'terminal' ? 'border-green-500 text-green-400 hover:bg-green-500/10' : 'border-slate-600 text-slate-400 hover:text-cyan-400 hover:border-cyan-400'}`;
  });

  // Google Sign-In
  if (googleSignIn) {
    googleSignIn.addEventListener('click', async () => {
      googleSignIn.disabled = true;
      googleSignIn.textContent = 'Signing in...';
      try {
        await signInWithGoogle();
        // Re-render to show admin UI
        renderHome(container);
      } catch (err) {
        showError(container, err.message);
        googleSignIn.disabled = false;
        googleSignIn.textContent = 'Sign in with Google (Admin)';
      }
    });
  }

  // Sign out
  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      await signOutAdmin();
      renderHome(container);
    });
  }

  // Create room (admin only)
  if (createBtn) {
    createBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) {
        showError(container, 'Please enter your name');
        nameInput.focus();
        return;
      }
      localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, name);
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
  }

  // Join room (anyone)
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
    localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, name);
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

  if (adminBtn) {
    adminBtn.addEventListener('click', () => navigate('admin'));
  }
}
