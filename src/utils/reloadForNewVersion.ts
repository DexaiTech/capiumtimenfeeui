/** When this tab last reloaded because a page file was missing (session storage, per tab). */
const STORAGE_KEY = 'capium:reloaded-for-new-version';

/** At most one automatic reload in this window, so a real outage can never loop (APT82). */
export const RELOAD_GUARD_MS = 30_000;

let pending = false;

export interface ReloadOptions {
  now?: number;
  reload?: () => void;
}

/**
 * A page or chart file failed to download. Most often a new version was released while this tab
 * was open and the old file names are gone (APT82), so reload once to load the new version.
 * Returns false and does nothing while offline, when session storage can't be used, or when this
 * tab already reloaded for that reason in the last 30 seconds: the caller then shows its message.
 */
export function reloadForNewVersion({
  now = Date.now(),
  reload = () => window.location.reload(),
}: ReloadOptions = {}): boolean {
  if (pending) return true;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  try {
    const last = Number(window.sessionStorage.getItem(STORAGE_KEY));
    if (last && now - last < RELOAD_GUARD_MS) return false;
    window.sessionStorage.setItem(STORAGE_KEY, String(now));
  } catch {
    return false;
  }
  pending = true;
  reload();
  return true;
}

/** Test helper: forget a reload started in this module (a real reload replaces the page). */
export function resetReloadForNewVersion(): void {
  pending = false;
}
