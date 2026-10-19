import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useToast } from '@/components/ui';
import { queryKeys } from '@/constants/queryKeys';
import {
  endSession,
  isApiError,
  refreshSession,
  subscribeAccountNotice,
  subscribeSession,
  type ApiError,
  type SessionEndReason,
} from '@/services/api';
import type { User } from '@/types/models';

import { authApi } from '../api/authApi';
import { AuthContext, type AuthContextValue, type AuthStatus } from '../authContext';

export interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Owns the session state of the tab. On mount it tries one silent refresh (the access
 * token only lives in memory, so a reload starts without one). Afterwards it is driven
 * by session events from the API client: login, refresh, logout and expiry, in this
 * tab or another. The user object itself is server state and lives in the `['me']` query.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [bootstrapError, setBootstrapError] = useState<ApiError | null>(null);
  const [lastEndReason, setLastEndReason] = useState<SessionEndReason | null>(null);
  const statusRef = useRef<AuthStatus>(status);

  const applyStatus = useCallback((next: AuthStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  useEffect(
    () =>
      subscribeSession((event) => {
        if (event.type === 'started') {
          queryClient.setQueryData(queryKeys.me(), event.auth.user);
          setBootstrapError(null);
          setLastEndReason(null);
          applyStatus('authenticated');
          return;
        }
        const wasAuthenticated = statusRef.current === 'authenticated';
        // When a session ends the whole cache goes: nothing of it may linger. A visitor
        // whose silent restore failed never had one, and clearing then would cancel the
        // requests that public pages (share links, invitations) have already started.
        if (wasAuthenticated) queryClient.clear();
        setLastEndReason(event.reason);
        applyStatus('anonymous');
        if (wasAuthenticated && event.reason === 'expired') {
          toast({
            tone: 'warning',
            title: 'Your session has expired',
            description: 'Sign in again to continue.',
          });
        }
      }),
    [applyStatus, queryClient, toast],
  );

  // Any request may find out that the account still has a temporary password (403
  // PASSWORD_CHANGE_REQUIRED). The user object says so, and the guards act on it.
  useEffect(
    () =>
      subscribeAccountNotice((notice) => {
        if (notice !== 'password-change-required') return;
        queryClient.setQueryData<User>(queryKeys.me(), (current) =>
          current && current.must_change_password !== true
            ? { ...current, must_change_password: true }
            : current,
        );
      }),
    [queryClient],
  );

  /** The silent refresh. Only its failure needs handling: success arrives as a session event. */
  const runBootstrap = useCallback(() => {
    refreshSession().catch((error: unknown) => {
      // A 401 already produced an "ended" event. Anything else leaves the state unknown.
      if (isApiError(error) && error.status === 401) return;
      if (isApiError(error) && error.status !== 0 && error.status < 500) {
        applyStatus('anonymous');
        return;
      }
      setBootstrapError(isApiError(error) ? error : null);
      applyStatus('error');
    });
  }, [applyStatus]);

  useEffect(() => {
    runBootstrap();
  }, [runBootstrap]);

  const retryBootstrap = useCallback(() => {
    applyStatus('loading');
    setBootstrapError(null);
    runBootstrap();
  }, [applyStatus, runBootstrap]);

  const { data: user } = useQuery({
    queryKey: queryKeys.me(),
    queryFn: ({ signal }) => authApi.me(signal),
    enabled: status === 'authenticated',
    staleTime: 5 * 60_000,
  });

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Logout always succeeds for the user: the local session is cleared regardless.
    }
    endSession('logout');
  }, []);

  const clearSession = useCallback(() => endSession('logout'), []);

  const refreshUser = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.me(), exact: true }),
    [queryClient],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: status === 'authenticated' ? (user ?? null) : null,
      lastEndReason,
      bootstrapError,
      retryBootstrap,
      logout,
      clearSession,
      refreshUser,
    }),
    [
      status,
      user,
      lastEndReason,
      bootstrapError,
      retryBootstrap,
      logout,
      clearSession,
      refreshUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
