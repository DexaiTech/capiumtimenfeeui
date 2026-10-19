import { Button, Modal } from '@/components/ui';

export interface IdleWarningDialogProps {
  open: boolean;
  /** Whole seconds until the person is signed out. */
  secondsLeft: number;
  onStay: () => void;
  onSignOut: () => void;
}

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** The blocking "are you still there?" notice shown five minutes before an idle sign-out. */
export function IdleWarningDialog({
  open,
  secondsLeft,
  onStay,
  onSignOut,
}: IdleWarningDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onStay}
      dismissible={false}
      closeOnBackdrop={false}
      size="sm"
      title="Are you still there?"
      footer={
        <>
          <Button onClick={onSignOut}>Sign out</Button>
          <Button variant="primary" onClick={onStay} autoFocus>
            Stay signed in
          </Button>
        </>
      }
    >
      <p className="text-sm text-text-muted">
        You have not done anything for a while. For your security you will be signed out in{' '}
        <strong className="font-semibold text-text tabular-nums">{clock(secondsLeft)}</strong>.
      </p>
    </Modal>
  );
}
