import { api } from '@/services/api';
import type { Session, User } from '@/types/models';

import type { ChangePasswordValues, ProfileValues } from '../schemas';

/** Typed wrappers over the current-user endpoints (`app/api/v1/users.py`). */
export const accountApi = {
  getProfile: (signal?: AbortSignal) => api.get<User>('/users/me', { signal }),
  updateProfile: (values: Partial<ProfileValues>) => api.patch<User>('/users/me', values),
  changePassword: (values: ChangePasswordValues) => api.post<null>('/users/me/password', values),
  // A small, bounded collection: the API returns every active session at once.
  listSessions: (signal?: AbortSignal) => api.get<Session[]>('/users/me/sessions', { signal }),
  revokeSession: (sessionId: string) =>
    api.delete<null>(`/users/me/sessions/${encodeURIComponent(sessionId)}`),
};
