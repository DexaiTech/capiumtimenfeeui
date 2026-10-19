import type { AuthPayload } from '@/types/models';

import { publish } from './channel';
import { isApiError } from './errors';
import { endSession, remoteSessions, startSession } from './session';
import { send, unwrap } from './transport';

const LOCK_NAME = 'auth-refresh';
/** After waiting for another tab's lock, give its BroadcastChannel message a moment to arrive. */
const REMOTE_SETTLE_MS = 50;
/** Without Web Locks: how long to wait for a tab that announced a refresh. */
const FALLBACK_WAIT_MS = 2_000;

let inFlight: Promise<AuthPayload> | null = null;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function performRefresh(): Promise<AuthPayload> {
  try {
    const response = await send('/auth/refresh', { method: 'POST' });
    const { data } = await unwrap<AuthPayload>(response);
    startSession(data);
    return data;
  } catch (error) {
    // Only a 401 means the session is over. A network failure keeps the session:
    // the original request fails with a retryable error instead.
    if (isApiError(error) && error.status === 401) endSession('expired');
    throw error;
  }
}

async function waitForRemote(sinceVersion: number, timeoutMs: number): Promise<AuthPayload | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const remote = remoteSessions.since(sinceVersion);
    if (remote) return remote;
    await delay(REMOTE_SETTLE_MS);
  }
  return remoteSessions.since(sinceVersion);
}

async function refreshAcrossTabs(): Promise<AuthPayload> {
  const sinceVersion = remoteSessions.version();
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;

  if (locks) {
    // Fast path: nobody else is refreshing.
    const immediate = await locks.request(LOCK_NAME, { ifAvailable: true }, (lock) =>
      lock ? performRefresh() : null,
    );
    if (immediate) return immediate;

    // Another tab holds the lock. Once it is released, use what that tab published
    // instead of rotating the refresh token a second time.
    return locks.request(LOCK_NAME, async () => {
      await delay(REMOTE_SETTLE_MS);
      return remoteSessions.since(sinceVersion) ?? performRefresh();
    });
  }

  // Fallback: BroadcastChannel alone. The server's grace window covers the remaining race.
  if (remoteSessions.refreshStartedWithin(FALLBACK_WAIT_MS)) {
    const remote = await waitForRemote(sinceVersion, FALLBACK_WAIT_MS);
    if (remote) return remote;
  }
  publish({ type: 'refresh-started' });
  return performRefresh();
}

/**
 * Exchanges the refresh cookie for a new access token. Single-flighted: concurrent
 * callers in this tab share one promise, and tabs take turns through `navigator.locks`.
 * Rejects with the `ApiError` of the refresh call; a 401 has already ended the session.
 */
export function refreshSession(): Promise<AuthPayload> {
  inFlight ??= refreshAcrossTabs().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
