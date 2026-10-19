import type { AuthPayload } from '@/types/models';

import { onChannelMessage, publish, type SessionEndReason } from './channel';
import { tokenStore } from './tokenStore';

export type SessionEvent =
  | { type: 'started'; auth: AuthPayload; remote: boolean }
  | { type: 'ended'; reason: SessionEndReason; remote: boolean };

type Listener = (event: SessionEvent) => void;

const listeners = new Set<Listener>();

/** Sessions published by other tabs, counted so a waiting refresh can tell a new one arrived. */
let remoteVersion = 0;
let lastRemoteAuth: AuthPayload | null = null;
let remoteRefreshStartedAt = 0;

function emit(event: SessionEvent): void {
  for (const listener of listeners) listener(event);
}

onChannelMessage((message) => {
  switch (message.type) {
    case 'session':
      tokenStore.set(message.auth.access_token);
      lastRemoteAuth = message.auth;
      remoteVersion += 1;
      remoteRefreshStartedAt = 0;
      emit({ type: 'started', auth: message.auth, remote: true });
      break;
    case 'ended':
      tokenStore.clear();
      remoteRefreshStartedAt = 0;
      emit({ type: 'ended', reason: message.reason, remote: true });
      break;
    case 'refresh-started':
      remoteRefreshStartedAt = Date.now();
      break;
  }
});

/** The app (AuthProvider) listens here; the transport layer knows nothing about React. */
export function subscribeSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Called after login or a successful refresh in this tab. */
export function startSession(auth: AuthPayload): void {
  tokenStore.set(auth.access_token);
  publish({ type: 'session', auth });
  emit({ type: 'started', auth, remote: false });
}

/** Clears the token, tells the other tabs and notifies the app. Safe to call twice. */
export function endSession(reason: SessionEndReason): void {
  tokenStore.clear();
  publish({ type: 'ended', reason });
  emit({ type: 'ended', reason, remote: false });
}

export const remoteSessions = {
  version: (): number => remoteVersion,
  /** The session another tab published after `sinceVersion`, if any. */
  since: (sinceVersion: number): AuthPayload | null =>
    remoteVersion !== sinceVersion && tokenStore.get() !== null ? lastRemoteAuth : null,
  refreshStartedWithin: (ms: number): boolean => Date.now() - remoteRefreshStartedAt < ms,
};

/**
 * Something about the account that the whole application must react to, whichever request
 * found it out. Separate from session events: the session itself is fine.
 */
export type AccountNotice = 'password-change-required';

const noticeListeners = new Set<(notice: AccountNotice) => void>();

/** The app (AuthProvider) listens here, for example for a 403 `PASSWORD_CHANGE_REQUIRED`. */
export function subscribeAccountNotice(listener: (notice: AccountNotice) => void): () => void {
  noticeListeners.add(listener);
  return () => noticeListeners.delete(listener);
}

export function emitAccountNotice(notice: AccountNotice): void {
  for (const listener of noticeListeners) listener(notice);
}
