const KEY = 'nopetion-workspace';
export function selectedPersonalWorkspace() {
  try { return window.sessionStorage.getItem(KEY) || undefined; } catch { return undefined; }
}
export function selectPersonalWorkspace(id?: string) {
  try {
    if (id) window.sessionStorage.setItem(KEY, id);
    else window.sessionStorage.removeItem(KEY);
  } catch { /* The authenticated cookie remains the default. */ }
}
