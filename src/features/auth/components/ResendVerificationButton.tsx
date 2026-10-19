import { MailCheck } from 'lucide-react';

import { Button, useToast, type ButtonVariant } from '@/components/ui';
import { useCountdown } from '@/hooks';
import { isApiError } from '@/services/api';
import { formatWait } from '@/utils/format';

import { useResendVerification } from '../api/hooks';

export interface ResendVerificationButtonProps {
  email: string;
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

/** Cooldown after a successful resend, so a double click does not burn the hourly limit. */
const RESEND_COOLDOWN_SECONDS = 30;

/** Requests a new verification email. The response is the same whether or not the address exists. */
export function ResendVerificationButton({
  email,
  variant = 'secondary',
  fullWidth = false,
}: ResendVerificationButtonProps) {
  const resend = useResendVerification();
  const { toast } = useToast();
  const { secondsLeft, start } = useCountdown();

  const onClick = () => {
    resend.mutate(email, {
      onSuccess: () => {
        start(RESEND_COOLDOWN_SECONDS);
        toast({
          tone: 'success',
          title: 'Verification email sent',
          description: `If ${email} needs verifying, a new link is on its way.`,
        });
      },
      onError: (error) => {
        if (isApiError(error) && error.status === 429) {
          const seconds = error.retryAfter ?? 60;
          start(seconds);
          toast({
            tone: 'warning',
            title: 'Too many attempts',
            description: `Try again in ${formatWait(seconds)}.`,
          });
          return;
        }
        toast({
          tone: 'error',
          title: 'Could not send the email',
          description: isApiError(error) ? error.message : 'Please try again.',
        });
      },
    });
  };

  return (
    <Button
      variant={variant}
      fullWidth={fullWidth}
      loading={resend.isPending}
      disabled={secondsLeft > 0}
      onClick={onClick}
      leftIcon={<MailCheck className="size-4" aria-hidden="true" />}
    >
      {secondsLeft > 0
        ? `Resend available in ${formatWait(secondsLeft)}`
        : 'Resend verification email'}
    </Button>
  );
}
