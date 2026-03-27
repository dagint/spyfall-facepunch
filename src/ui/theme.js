const STORAGE_KEY = 'spyfall_theme';

/** Get the current theme name from localStorage (defaults to 'default'). */
export function getTheme() {
  return localStorage.getItem(STORAGE_KEY) || 'default';
}

/** Persist a theme choice and apply it to the document. */
export function setTheme(theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme();
}

/** Apply the current theme by toggling the terminal class on the body. */
export function applyTheme() {
  const theme = getTheme();
  document.body.classList.toggle('theme-terminal', theme === 'terminal');
}

/** Toggle between 'default' and 'terminal' themes. */
export function toggleTheme() {
  const current = getTheme();
  setTheme(current === 'terminal' ? 'default' : 'terminal');
}
