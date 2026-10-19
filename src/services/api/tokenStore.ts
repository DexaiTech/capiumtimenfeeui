/**
 * The access token lives in this module-level variable and nowhere else.
 * It is never written to localStorage, sessionStorage, a cookie or a Zustand store;
 * it is lost on reload and recovered by a silent refresh.
 */
let accessToken: string | null = null;

export const tokenStore = {
  get(): string | null {
    return accessToken;
  },
  set(token: string): void {
    accessToken = token;
  },
  clear(): void {
    accessToken = null;
  },
};
