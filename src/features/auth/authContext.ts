import { createContext, useContext } from 'react';

import type { ApiError, SessionEndReason } from '@/services/api';
import type { User } from '@/types/models';

/**
 * `loading`: the silent refresh on first load has not answered yet.
 * `error`: that refresh could not reach the server, so the session state is unknown.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'error';

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** Why the last session ended; lets the guard skip `?next=` after a deliberate logout. */
  lastEndReason: SessionEndReason | null;
  bootstrapError: ApiError | null;
  retryBootstrap: () => void;
  /** Revokes the session on the server (best effort) and clears it locally and in other tabs. */
  logout: () => Promise<void>;
  /** Clears the local session after the server has already revoked it (logout everywhere, password reset). */
  clearSession: () => void;
  /** Refetches the current user, for example after email verification. */
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
