/**
 * Base URL of the API including the version prefix, for example `/api/v1`.
 * A relative value is resolved against the page origin (same-origin through the dev proxy).
 */
export const API_BASE_URL: string = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/+$/, '');

export function resolveApiUrl(path: string, search = ''): string {
  const target = `${API_BASE_URL}${path}${search}`;
  return /^https?:\/\//i.test(target) ? target : new URL(target, window.location.origin).toString();
}

/** The refresh cookie is scoped to the auth path, so only these requests carry credentials. */
export function needsCredentials(path: string): boolean {
  return path.startsWith('/auth/');
}

const CSRF_HEADER_PATHS = new Set(['/auth/refresh', '/auth/logout', '/auth/logout-all']);

/** The server rejects refresh and logout requests without `X-Requested-With`. */
export function needsRequestedWith(path: string): boolean {
  return CSRF_HEADER_PATHS.has(path);
}

/**
 * A 401 from these endpoints is an answer, not an expired access token: login reports
 * bad credentials, refresh reports a dead session. They are never replayed.
 */
export function refreshesOn401(path: string): boolean {
  return !path.startsWith('/auth/') || path === '/auth/logout-all';
}
