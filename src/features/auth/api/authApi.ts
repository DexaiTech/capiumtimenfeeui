import { api } from '@/services/api';
import type { AuthPayload, User } from '@/types/models';

import type { LoginValues, RegisterValues, ResetPasswordValues } from '../schemas';

/** Thin, typed wrappers over the M1 authentication endpoints (docs/api.md). */
export const authApi = {
  login: (values: LoginValues) => api.post<AuthPayload>('/auth/login', values),
  register: (values: RegisterValues) => api.post<null>('/auth/register', values),
  logout: () => api.post<null>('/auth/logout'),
  logoutAll: () => api.post<{ revoked: number }>('/auth/logout-all'),
  verifyEmail: (token: string) => api.post<null>('/auth/verify-email', { token }),
  resendVerification: (email: string) => api.post<null>('/auth/resend-verification', { email }),
  forgotPassword: (email: string) => api.post<null>('/auth/forgot-password', { email }),
  resetPassword: (token: string, values: ResetPasswordValues) =>
    api.post<null>('/auth/reset-password', { token, ...values }),
  me: (signal?: AbortSignal) => api.get<User>('/users/me', { signal }),
};
