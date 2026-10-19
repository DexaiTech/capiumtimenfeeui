import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { useReturnPathStore } from '@/app/store';
import { loginRouteWithNext, safeNextPath } from '@/constants/routes';
import { CheckInbox, RegisterForm } from '@/features/auth';
import { useDocumentTitle } from '@/hooks';

import { AuthFooterLink, AuthHeading, authLinkClasses } from './AuthHeading';

export function RegisterPage() {
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const setReturnPath = useReturnPathStore((state) => state.setReturnPath);
  useDocumentTitle(registeredEmail ? 'Check your inbox' : 'Create your account');
  const next = safeNextPath(searchParams.get('next'));
  const email = searchParams.get('email') ?? undefined;

  if (registeredEmail) return <CheckInbox email={registeredEmail} />;

  return (
    <>
      <AuthHeading title="Create your account">
        {next
          ? 'Create your account; after verifying your email you continue where you left off.'
          : 'Start with your own account; you can create your practice next.'}
      </AuthHeading>
      <RegisterForm
        defaultEmail={email}
        onRegistered={(registered) => {
          // The verification link in the email carries no `next`; remember it for this tab.
          if (next) setReturnPath(next);
          setRegisteredEmail(registered);
        }}
      />
      <AuthFooterLink>
        Already have an account?{' '}
        <Link to={loginRouteWithNext(next, email)} className={authLinkClasses}>
          Sign in
        </Link>
      </AuthFooterLink>
    </>
  );
}
