const routes = {};
let currentCleanup = null;

/** Register a route handler: register('home', (container, params) => { ... return cleanup }) */
export function register(name, handler) {
  routes[name] = handler;
}

/** Navigate to a route */
export function navigate(name, params = {}) {
  const hash = `#${name}`;
  if (window.location.hash !== hash) {
    window.location.hash = hash;
  } else {
    // Force re-render even if hash is the same
    renderRoute(name, params);
  }
  // Store params for hash-change driven navigation
  navigate._pendingParams = params;
}

/** Start listening for hash changes */
export function startRouter() {
  window.addEventListener('hashchange', () => {
    const name = window.location.hash.slice(1) || 'home';
    const params = navigate._pendingParams || {};
    navigate._pendingParams = null;
    renderRoute(name, params);
  });

  // Initial route
  const initial = window.location.hash.slice(1) || 'home';
  renderRoute(initial, {});
}

function renderRoute(name, params) {
  const handler = routes[name];
  if (!handler) {
    navigate('home');
    return;
  }

  // Cleanup previous screen
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }

  const app = document.getElementById('app');
  app.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'flex flex-col flex-1';
  app.appendChild(container);

  currentCleanup = handler(container, params) || null;
}
