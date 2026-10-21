import { api, type UploadOptions } from '@/services/api';
import type { Session, User } from '@/types/models';

import type { ChangePasswordValues, ProfileValues } from '../schemas';

/** Typed wrappers over the current-user endpoints (`app/api/v1/users.py`). */
export const accountApi = {
  getProfile: (signal?: AbortSignal) => api.get<User>('/users/me', { signal }),
  updateProfile: (values: Partial<ProfileValues>) => api.patch<User>('/users/me', values),
  /** Multipart upload of the profile picture (PNG, JPEG, WebP or GIF, up to 2 MB). */
  uploadAvatar: (file: File, options: UploadOptions = {}) => {
    const form = new FormData();
    form.append('file', file);
    return api.upload<User>('/users/me/avatar', form, options);
  },
  removeAvatar: () => api.delete<User>('/users/me/avatar'),
  changePassword: (values: ChangePasswordValues) => api.post<null>('/users/me/password', values),
  // A small, bounded collection: the API returns every active session at once.
  listSessions: (signal?: AbortSignal) => api.get<Session[]>('/users/me/sessions', { signal }),
  revokeSession: (sessionId: string) =>
    api.delete<null>(`/users/me/sessions/${encodeURIComponent(sessionId)}`),
};
