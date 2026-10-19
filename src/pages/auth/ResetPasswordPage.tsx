import { Link2Off } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { buttonClasses, useToast } from '@/components/ui';
import { routes } from '@/constants/routes';
import { AuthStatusPanel, ResetPasswordForm, useAuth } from '@/features/auth';
import { useDocumentTitle } from '@/hooks';

import { AuthHeading } from './AuthHeading';
import { useOneTimeToken } from './useOneTimeToken';

export function ResetPasswordPage() {
  useDocumentTitle('Choose a new password');
  const token = useOneTimeToken();
  const [invalid, setInvalid] = useState(false);
  const { clearSession } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  if (!token || invalid) {
    return (
      <AuthStatusPanel
        icon={<Link2Off className="size-7" />}
        tone="danger"
        title="This link is invalid or has expired"
        actions={
          <>
            <Link
              to={routes.forgotPassword}
              className={buttonClasses({ variant: 'primary', fullWidth: true })}
            >
              Request a new link
            </Link>
            <Link
              to={routes.login}
              className={buttonClasses({ variant: 'ghost', fullWidth: true })}
            >
              Back to sign in
            </Link>
          </>
        }
      >
        <p>Reset links work once and expire after one hour.</p>
      </AuthStatusPanel>
    );
  }

  const onDone = () => {
    // The server revoked every session; drop the local one too and tell the other tabs.
    clearSession();
    toast({
      tone: 'success',
      title: 'Password updated',
      description: 'Sign in with your new password.',
    });
    void navigate(routes.login, { replace: true });
  };

  return (
    <>
      <AuthHeading title="Choose a new password">
        You will be signed out everywhere and can sign in with the new password.
      </AuthHeading>
      <ResetPasswordForm token={token} onDone={onDone} onInvalidToken={() => setInvalid(true)} />
    </>
  );
}
