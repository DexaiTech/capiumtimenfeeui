import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/constants/queryKeys';
import { authApi } from '@/features/auth';
import { refreshSession } from '@/services/api';
import type { User } from '@/types/models';

import type { ChangePasswordValues, ProfileValues } from '../schemas';
import { accountApi } from './accountApi';

/** The current user. Shares the `['me']` cache entry seeded at sign-in. */
export function useProfile() {
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: ({ signal }) => accountApi.getProfile(signal),
    staleTime: 5 * 60_000,
  });
}

function useUserMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<User>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    // Not optimistic: the cache is updated from the response.
    onSuccess: (user) => queryClient.setQueryData(queryKeys.me(), user),
  });
}

export function useUpdateProfile() {
  return useUserMutation((values: Partial<ProfileValues>) => accountApi.updateProfile(values));
}

export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: ChangePasswordValues) => accountApi.changePassword(values),
    onSuccess: async () => {
      // The temporary password is gone: let the guards know before anything else is asked.
      queryClient.setQueryData<User>(queryKeys.me(), (current) =>
        current?.must_change_password ? { ...current, must_change_password: false } : current,
      );
      // Access tokens issued before the change are rejected by the API, so fetch a
      // fresh one now instead of waiting for the next request to hit a 401.
      await refreshSession().catch(() => undefined);
      await queryClient.invalidateQueries({ queryKey: queryKeys.sessions() });
    },
  });
}

export function useSessions() {
  return useQuery({
    queryKey: queryKeys.sessions(),
    queryFn: ({ signal }) => accountApi.listSessions(signal),
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => accountApi.revokeSession(sessionId),
    // Also on error: a 404 means the session is already gone, so the list is stale either way.
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.sessions() }),
  });
}

export function useLogoutAll() {
  return useMutation({ mutationFn: () => authApi.logoutAll() });
}
