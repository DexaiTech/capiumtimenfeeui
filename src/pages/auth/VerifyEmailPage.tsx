import { CircleCheckBig, MailX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { buttonClasses, ErrorState, Spinner, useToast } from '@/components/ui';
import { useReturnPathStore } from '@/app/store';
import { loginRouteWithNext, POST_LOGIN_ROUTE, routes, safeNextPath } from '@/constants/routes';
import {
  AuthStatusPanel,
  EmailRequestForm,
  ResendVerificationButton,
  useAuth,
  useResendVerification,
  useVerifyEmail,
} from '@/features/auth';
import { useDocumentTitle } from '@/hooks';
import { isApiError } from '@/services/api';

import { useOneTimeToken } from './useOneTimeToken';

/** The invalid-link state: one message for unknown, used and expired tokens, with a way to get a new link. */
function InvalidLink({ knownEmail }: { knownEmail: string | null }) {
  const resend = useResendVerification();
  const { toast } = useToast();
  const [sentTo, setSentTo] = useState<string | null>(null);

  return (
    <AuthStatusPanel
      icon={<MailX className="size-7" />}
      tone="danger"
      title="This link is invalid or has expired"
      actions={
        knownEmail ? (
          <ResendVerificationButton email={knownEmail} variant="primary" fullWidth />
        ) : sentTo ? (
          <Link
            to={routes.login}
            className={buttonClasses({ variant: 'secondary', fullWidth: true })}
          >
            Back to sign in
          </Link>
        ) : (
          <EmailRequestForm
            submitLabel="Send a new link"
            onSubmitEmail={(email) => resend.mutateAsync(email)}
            onSent={(email) => {
              setSentTo(email);
              toast({ tone: 'success', title: 'Verification email sent' });
            }}
          />
        )
      }
    >
      {sentTo ? (
        <p>
          If <strong className="font-semibold break-all text-text">{sentTo}</strong> needs
          verifying, a new link is on its way.
        </p>
      ) : (
        <p>Verification links work once and expire after 24 hours. Request a new one below.</p>
      )}
    </AuthStatusPanel>
  );
}

export function VerifyEmailPage() {
  useDocumentTitle('Verify your email');
  const token = useOneTimeToken();
  const verify = useVerifyEmail();
  const { status, user, refreshUser } = useAuth();
  const started = useRef(false);
  // Where the visitor was heading before registering (an invitation), if this tab remembers it.
  const returnPath = safeNextPath(useReturnPathStore((state) => state.returnPath));
  const { mutate } = verify;

  useEffect(() => {
    // The token is single use: guard against the double effect of React strict mode.
    if (!token || started.current) return;
    started.current = true;
    mutate(token, { onSuccess: () => void refreshUser() });
  }, [token, mutate, refreshUser]);

  const knownEmail = user && !user.email_verified ? user.email : null;

  if (!token) return <InvalidLink knownEmail={knownEmail} />;

  if (verify.isSuccess) {
    const signedIn = status === 'authenticated';
    return (
      <AuthStatusPanel
        icon={<CircleCheckBig className="size-7" />}
        tone="success"
        title="Email verified"
        actions={
          <Link
            to={signedIn ? (returnPath ?? POST_LOGIN_ROUTE) : loginRouteWithNext(returnPath)}
            className={buttonClasses({ variant: 'primary', size: 'lg', fullWidth: true })}
          >
            {signedIn ? 'Continue to the app' : 'Sign in'}
          </Link>
        }
      >
        <p>
          Your account is active.{' '}
          {signedIn ? 'You can continue where you left off.' : 'Sign in to get started.'}
        </p>
      </AuthStatusPanel>
    );
  }

  if (verify.isError) {
    const { error } = verify;
    if (
      isApiError(error) &&
      (error.code === 'TOKEN_INVALID' || error.status === 400 || error.status === 422)
    ) {
      return <InvalidLink knownEmail={knownEmail} />;
    }
    // Network, timeout, rate limit or server error: the token is still good, so offer a retry.
    return (
      <ErrorState
        title="Could not verify your email"
        error={
          isApiError(error) && error.status === 429 && error.retryAfter
            ? {
                message: `Too many attempts. Try again in ${error.retryAfter} seconds.`,
                requestId: error.requestId,
              }
            : isApiError(error)
              ? error
              : null
        }
        onRetry={() => mutate(token, { onSuccess: () => void refreshUser() })}
        className="py-4"
      />
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-4 py-8 text-center"
    >
      <Spinner size="lg" className="text-primary-text" />
      <h1 className="text-xl font-semibold text-text">Verifying your email…</h1>
      <p className="text-sm text-text-muted">This only takes a moment.</p>
    </div>
  );
}
