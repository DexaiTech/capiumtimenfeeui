import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  RELOAD_GUARD_MS,
  reloadForNewVersion,
  resetReloadForNewVersion,
} from './reloadForNewVersion';

describe('reloadForNewVersion (APT82)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    resetReloadForNewVersion();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reloads once to load the new version', () => {
    const reload = vi.fn();
    expect(reloadForNewVersion({ now: 1_000_000, reload })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('never reloads twice within the guard window, so a real outage cannot loop', () => {
    const reload = vi.fn();
    reloadForNewVersion({ now: 1_000_000, reload });
    resetReloadForNewVersion(); // the page came back after the reload
    expect(reloadForNewVersion({ now: 1_000_000 + RELOAD_GUARD_MS - 1, reload })).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reloadForNewVersion({ now: 1_000_000 + RELOAD_GUARD_MS, reload })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('does not reload while offline', () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    const reload = vi.fn();
    expect(reloadForNewVersion({ reload })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload when session storage cannot be used', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const reload = vi.fn();
    expect(reloadForNewVersion({ reload })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('answers yes again while its reload is under way, without reloading again', () => {
    const reload = vi.fn();
    reloadForNewVersion({ now: 5_000_000, reload });
    expect(reloadForNewVersion({ now: 5_000_001, reload })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
