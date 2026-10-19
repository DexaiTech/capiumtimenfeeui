/** Public surface of the auth feature. Other areas import from here, never from its internals. */
export { authApi } from './api/authApi';
export { useForgotPassword, useResendVerification, useVerifyEmail } from './api/hooks';
export { useAuth, type AuthContextValue, type AuthStatus } from './authContext';
export { AuthProvider } from './components/AuthProvider';
export { AuthStatusPanel } from './components/AuthStatusPanel';
export { CheckInbox } from './components/CheckInbox';
export { EmailRequestForm } from './components/EmailRequestForm';
export { RedirectIfAuthenticated, RequireAuth, RequireVerified } from './components/guards';
export { LoginForm } from './components/LoginForm';
export { PasswordStrength } from './components/PasswordStrength';
export { RegisterForm } from './components/RegisterForm';
export { ResendVerificationButton } from './components/ResendVerificationButton';
export { ResetPasswordForm } from './components/ResetPasswordForm';
export { newPasswordField } from './schemas';
