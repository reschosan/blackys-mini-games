const VIEW_MODE_KEY = 'blackys-mini-games:guestView';

/** "own": the race is drawn on this phone with a camera on the own kart. "controller": this phone only steers, the picture is on the host. */
export type ViewMode = 'own' | 'controller';

export function loadViewMode(): ViewMode {
  try {
    return window.localStorage.getItem(VIEW_MODE_KEY) === 'controller' ? 'controller' : 'own';
  } catch {
    return 'own';
  }
}

export function saveViewMode(mode: ViewMode): void {
  try {
    window.localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    // The choice just does not survive a reload.
  }
}
