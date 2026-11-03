// Thin wrapper around localStorage: private mode, blocked storage and
// WebViews without storage must never crash the app.
const PREFIX = 'ion:';

export const storage = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(PREFIX) && k !== PREFIX + 'lang')
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  },
};
