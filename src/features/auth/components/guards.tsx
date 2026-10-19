import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router';

import { FullScreenLoader } from '@/components/common/FullScreenLoader';
import { ErrorState } from '@/components/ui';
import { loginRouteWithNext, POST_LOGIN_ROUTE, routes, safeNextPath } from '@/constants/routes';

import { useAuth } from '../authContext';
import { VerificationPending } from './VerificationPending';

/**
 * A user must be loaded. On first load there is no access token in memory, so the
 * guard waits for the silent refresh before deciding.
 */
export function RequireAuth() {
  const { status, user, bootstrapError, retryBootstrap, lastEndReason } = useAuth();
  const location = useLocation();

  if (status === 'loading' || (status === 'authenticated' && !user)) {
    return <FullScreenLoader label="Restoring your session" />;
  }
  if (status === 'error') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg">
        <ErrorState
          title="Could not restore your session"
          error={
            bootstrapError ?? { message: 'The server could not be reached. Check your connection.' }
          }
          onRetry={retryBootstrap}
        />
      </main>
    );
  }
  if (status === 'anonymous') {
    // After a deliberate logout there is no page to come back to.
    const target =
      lastEndReason === 'logout'
        ? routes.login
        : loginRouteWithNext(`${location.pathname}${location.search}${location.hash}`);
    return <Navigate to={target} replace />;
  }
  // A temporary password (an account made by an administrator, or reset by one) must be
  // replaced before anything else: every route leads to the "Choose a new password" screen.
  if (user?.must_change_password && location.pathname !== routes.changePassword) {
    return (
      <Navigate
        to={routes.changePassword}
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }
  return <Outlet />;
}

/** Unverified users can sign in but only reach the "verify your email" screen. */
export function RequireVerified() {
  const { user } = useAuth();
  if (!user) return null;
  return user.email_verified ? <Outlet /> : <VerificationPending user={user} />;
}

/** Keeps signed-in users out of the sign-in pages and sends them on to `next` or the app. */
export function RedirectIfAuthenticated() {
  const { status } = useAuth();
  const [searchParams] = useSearchParams();

  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'authenticated') {
    return <Navigate to={safeNextPath(searchParams.get('next')) ?? POST_LOGIN_ROUTE} replace />;
  }
  return <Outlet />;
}
