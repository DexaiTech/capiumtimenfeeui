import { MailOpen } from 'lucide-react';
import { Link } from 'react-router';

import { buttonClasses } from '@/components/ui';
import { routes } from '@/constants/routes';

import { AuthStatusPanel } from './AuthStatusPanel';
import { ResendVerificationButton } from './ResendVerificationButton';

export interface CheckInboxProps {
  email: string;
}

/** Shown after registration. The wording is the same whether or not the address already had an account. */
export function CheckInbox({ email }: CheckInboxProps) {
  return (
    <AuthStatusPanel
      icon={<MailOpen className="size-7" />}
      title="Check your inbox"
      actions={
        <>
          <ResendVerificationButton email={email} fullWidth />
          <Link to={routes.login} className={buttonClasses({ variant: 'ghost', fullWidth: true })}>
            Back to sign in
          </Link>
        </>
      }
    >
      <p>
        We sent a verification link to{' '}
        <strong className="font-semibold break-all text-text">{email}</strong>. Open it to activate
        your account.
      </p>
      <p>The link is valid for 24 hours. Check your spam folder if it has not arrived.</p>
    </AuthStatusPanel>
  );
}
