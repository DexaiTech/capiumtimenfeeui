import { LogOut } from 'lucide-react';
import { useState } from 'react';

import { Button, Modal, useToast } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { isApiError } from '@/services/api';

import { useLogoutAll } from '../api/hooks';

/** Revokes every session of the user, this one included, after a confirmation. */
export function LogoutEverywhere() {
  const [confirming, setConfirming] = useState(false);
  const logoutAll = useLogoutAll();
  const { clearSession } = useAuth();
  const { toast } = useToast();

  const onConfirm = () => {
    logoutAll.mutate(undefined, {
      onSuccess: ({ revoked }) => {
        setConfirming(false);
        toast({
          tone: 'success',
          title: 'Logged out everywhere',
          description: `${revoked} session${revoked === 1 ? '' : 's'} ended. Sign in again to continue.`,
        });
        clearSession();
      },
      onError: (error) =>
        toast({
          tone: 'error',
          title: 'Could not log out everywhere',
          description: isApiError(error) ? error.message : 'Please try again.',
        }),
    });
  };

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-text">Log out everywhere</h3>
          <p className="text-sm text-text-muted">
            Ends every session on every device, including this one.
          </p>
        </div>
        <Button
          variant="danger"
          leftIcon={<LogOut className="size-4" aria-hidden="true" />}
          onClick={() => setConfirming(true)}
          className="w-full sm:w-auto"
        >
          Log out everywhere
        </Button>
      </div>
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        size="sm"
        title="Log out everywhere?"
        description="You will be signed out on all devices, including this one, and will need to sign in again."
        footer={
          <>
            <Button onClick={() => setConfirming(false)} disabled={logoutAll.isPending}>
              Cancel
            </Button>
            <Button variant="danger" loading={logoutAll.isPending} onClick={onConfirm}>
              Log out everywhere
            </Button>
          </>
        }
      />
    </>
  );
}
