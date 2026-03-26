const STORAGE_KEY = 'spyfall_theme';

export function getTheme() {
  return localStorage.getItem(STORAGE_KEY) || 'default';
}

export function setTheme(theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme();
}

export function applyTheme() {
  const theme = getTheme();
  document.body.classList.toggle('theme-terminal', theme === 'terminal');
}

export function toggleTheme() {
  const current = getTheme();
  setTheme(current === 'terminal' ? 'default' : 'terminal');
}
