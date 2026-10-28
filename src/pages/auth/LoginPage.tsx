import { Link, useLocation, useSearchParams } from 'react-router';

import { registerRouteWithNext } from '@/constants/routes';
import { LoginForm } from '@/features/auth';
import { useSystemInfo } from '@/features/system';
import { useDocumentTitle } from '@/hooks';

import { AuthFooterLink, AuthHeading, authLinkClasses } from './AuthHeading';

export function LoginPage() {
  useDocumentTitle('Sign in');
  const [searchParams] = useSearchParams();
  // Set by pages that send the visitor here on the way to something (an invitation).
  const email = searchParams.get('email') ?? undefined;
  const { openRegistration, closed } = useSystemInfo();
  // Set by the routes that only exist while sign-up is open, when they turn a visitor away.
  const notice = (useLocation().state as { notice?: string } | null)?.notice;

  return (
    <>
      <AuthHeading title="Sign in">Use your Capium email and password.</AuthHeading>
      {notice ? (
        <p
          role="status"
          className="mb-4 rounded-md bg-surface-hover px-3 py-2 text-sm text-text-muted"
        >
          {notice}
        </p>
      ) : null}
      <LoginForm defaultEmail={email} showForgotPassword={!closed} />
      {/* Sign-up exists only in an open deployment, and only once that is known. */}
      {openRegistration ? (
        <AuthFooterLink>
          New here?{' '}
          <Link
            to={registerRouteWithNext(searchParams.get('next'), email)}
            className={authLinkClasses}
          >
            Create an account
          </Link>
        </AuthFooterLink>
      ) : closed ? (
        <AuthFooterLink>
          Accounts are created by your administrator, who also resets forgotten passwords.
        </AuthFooterLink>
      ) : null}
    </>
  );
}
