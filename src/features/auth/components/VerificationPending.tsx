import { LogOut, MailWarning } from 'lucide-react';
import { useState } from 'react';

import { AuroraBackground } from '@/components/common/AuroraBackground';
import { Logo } from '@/components/common/Logo';
import { Button, Card, useToast } from '@/components/ui';
import { useDocumentTitle } from '@/hooks';
import type { User } from '@/types/models';

import { useAuth } from '../authContext';
import { AuthStatusPanel } from './AuthStatusPanel';
import { ResendVerificationButton } from './ResendVerificationButton';

export interface VerificationPendingProps {
  user: User;
}

/** What a signed-in but unverified user sees instead of the application. */
export function VerificationPending({ user }: VerificationPendingProps) {
  useDocumentTitle('Verify your email');
  const { logout, refreshUser } = useAuth();
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const checkAgain = async () => {
    setChecking(true);
    try {
      await refreshUser();
      toast({
        tone: 'info',
        title: 'Checked',
        description: 'If you have verified, the app opens now.',
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <AuroraBackground />
      <Logo size="lg" />
      <Card variant="gradient" padding="lg" className="w-full max-w-md">
        <AuthStatusPanel
          icon={<MailWarning className="size-7" />}
          title="Verify your email"
          actions={
            <>
              <ResendVerificationButton email={user.email} variant="primary" fullWidth />
              <Button fullWidth loading={checking} onClick={() => void checkAgain()}>
                I have verified — continue
              </Button>
              <Button
                variant="ghost"
                fullWidth
                loading={loggingOut}
                leftIcon={<LogOut className="size-4" aria-hidden="true" />}
                onClick={() => {
                  setLoggingOut(true);
                  void logout();
                }}
              >
                Log out
              </Button>
            </>
          }
        >
          <p>
            We sent a verification link to{' '}
            <strong className="font-semibold text-text">{user.email}</strong>. Open it to activate
            your account.
          </p>
          <p>The link is valid for 24 hours. Check your spam folder if it has not arrived.</p>
        </AuthStatusPanel>
      </Card>
    </main>
  );
}
