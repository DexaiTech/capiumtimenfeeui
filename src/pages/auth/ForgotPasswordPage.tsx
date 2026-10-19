import { MailOpen } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { buttonClasses, useToast } from '@/components/ui';
import { routes } from '@/constants/routes';
import { AuthStatusPanel, EmailRequestForm, useForgotPassword } from '@/features/auth';
import { useDocumentTitle } from '@/hooks';

import { AuthFooterLink, AuthHeading, authLinkClasses } from './AuthHeading';

export function ForgotPasswordPage() {
  useDocumentTitle('Reset your password');
  const forgot = useForgotPassword();
  const { toast } = useToast();
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (sentTo) {
    return (
      <AuthStatusPanel
        icon={<MailOpen className="size-7" />}
        title="Check your inbox"
        actions={
          <>
            <Link
              to={routes.login}
              className={buttonClasses({ variant: 'secondary', fullWidth: true })}
            >
              Back to sign in
            </Link>
            <button
              type="button"
              className={`${authLinkClasses} min-h-11 text-sm`}
              onClick={() => setSentTo(null)}
            >
              Use a different address
            </button>
          </>
        }
      >
        {/* Deliberately the same message whether or not the address has an account. */}
        <p>
          If an account exists for{' '}
          <strong className="font-semibold break-all text-text">{sentTo}</strong>, we have sent a
          link to reset the password.
        </p>
        <p>The link works once and expires after one hour.</p>
      </AuthStatusPanel>
    );
  }

  return (
    <>
      <AuthHeading title="Forgot your password?">
        Enter your email address and we will send you a link to choose a new one.
      </AuthHeading>
      <EmailRequestForm
        submitLabel="Send reset link"
        onSubmitEmail={(email) => forgot.mutateAsync(email)}
        onSent={(email) => {
          setSentTo(email);
          toast({
            tone: 'success',
            title: 'Request received',
            description: 'Check your inbox for the link.',
          });
        }}
      />
      <AuthFooterLink>
        Remembered it?{' '}
        <Link to={routes.login} className={authLinkClasses}>
          Back to sign in
        </Link>
      </AuthFooterLink>
    </>
  );
}
