export function getThemePreference(storage) {
  try { const value = storage.getItem('shop-finder-theme'); return ['light','dark','system'].includes(value) ? value : 'light'; }
  catch { return 'light'; }
}
export function resolveTheme(preference, systemDark) {
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference === 'dark' ? 'dark' : 'light';
}
