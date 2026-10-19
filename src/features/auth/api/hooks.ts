import { useMutation } from '@tanstack/react-query';

import { startSession } from '@/services/api';

import type { LoginValues, RegisterValues, ResetPasswordValues } from '../schemas';
import { authApi } from './authApi';

export function useLogin() {
  return useMutation({
    mutationFn: (values: LoginValues) => authApi.login(values),
    // Stores the access token in memory; the AuthProvider reacts to the session event.
    onSuccess: (auth) => startSession(auth),
  });
}

export function useRegister() {
  return useMutation({ mutationFn: (values: RegisterValues) => authApi.register(values) });
}

export function useVerifyEmail() {
  return useMutation({ mutationFn: (token: string) => authApi.verifyEmail(token) });
}

export function useResendVerification() {
  return useMutation({ mutationFn: (email: string) => authApi.resendVerification(email) });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: (email: string) => authApi.forgotPassword(email) });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, values }: { token: string; values: ResetPasswordValues }) =>
      authApi.resetPassword(token, values),
  });
}
