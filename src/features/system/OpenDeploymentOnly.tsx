import { Navigate, Outlet } from 'react-router';

import { FullScreenLoader } from '@/components/common/FullScreenLoader';
import { routes } from '@/constants/routes';

import { useSystemInfo } from './useSystemInfo';

/** The calm explanation shown on the sign-in page when a closed deployment turns a visitor away. */
export const CLOSED_DEPLOYMENT_NOTICE =
  'Accounts here are created by your administrator. Sign in with the details you were given.';

/** Shown when a closed deployment turns a visitor away from the self-service password reset. */
export const PASSWORD_RESET_NOTICE =
  'Passwords are reset by your administrator. Ask them for a new temporary password.';

/**
 * Wraps the routes that only exist while sign-up is open (registration, onboarding, invitations).
 * In a closed deployment they lead to the sign-in page, with a short explanation.
 */
export function OpenDeploymentOnly({ notice = CLOSED_DEPLOYMENT_NOTICE }: { notice?: string }) {
  const { ready, closed } = useSystemInfo();
  if (!ready) return <FullScreenLoader />;
  if (closed) return <Navigate to={routes.login} replace state={{ notice }} />;
  return <Outlet />;
}
