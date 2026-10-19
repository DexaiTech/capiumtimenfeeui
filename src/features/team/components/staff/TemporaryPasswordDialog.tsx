import { Copy, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import { Button, Input, Modal, useToast } from '@/components/ui';

export interface TemporaryPassword {
  /** Who the password is for. */
  fullName: string;
  /** The sign-in address. */
  email: string;
  password: string;
  /** A new staff member with an account, a login given to an existing one, or a password reset. */
  kind: 'created' | 'linked' | 'reset';
  /** A link to choose a password was also emailed to the person (new accounts only). */
  emailSent?: boolean;
}

export interface TemporaryPasswordDialogProps {
  /** Null closes the dialog and, with it, forgets the password. */
  secret: TemporaryPassword | null;
  onClose: () => void;
}

const TITLE: Record<TemporaryPassword['kind'], string> = {
  created: 'Staff member added',
  linked: 'Login created',
  reset: 'Password reset',
};

function description(secret: TemporaryPassword): string {
  switch (secret.kind) {
    case 'created':
      return `${secret.fullName} was added. Give them this password to sign in.`;
    case 'linked':
      return `${secret.fullName} can now sign in. Give them this password.`;
    case 'reset':
      return `The password of ${secret.fullName} was reset and all their sessions ended.`;
  }
}

function PasswordPanel({
  secret,
  closeAttempted,
}: {
  secret: TemporaryPassword;
  closeAttempted: boolean;
}) {
  const { toast } = useToast();
  const [copyFailed, setCopyFailed] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret.password);
      setCopyFailed(false);
      // The toast never contains the password.
      toast({ tone: 'success', title: 'Password copied' });
    } catch {
      setCopyFailed(true);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        role="note"
        className="flex items-start gap-2.5 rounded-md border border-warning/40 bg-warning-soft px-3 py-2.5 text-sm text-text"
      >
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
        <p>
          This password is shown only once. It cannot be shown again after you close this dialog.{' '}
          {secret.fullName} must change it at their first sign-in.
        </p>
      </div>
      {secret.kind !== 'reset' && secret.emailSent ? (
        <p role="status" className="text-sm text-text-muted">
          We also emailed {secret.fullName} a link to choose their own password. Until they use it,
          the temporary password below works.
        </p>
      ) : null}
      <p className="text-sm text-text-muted">
        Sign-in email: <span className="font-medium break-all text-text">{secret.email}</span>
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Input
          label="Temporary password"
          type="text"
          readOnly
          value={secret.password}
          autoComplete="off"
          spellCheck={false}
          onFocus={(event) => event.currentTarget.select()}
          className="sm:flex-1 [&_input]:font-mono"
        />
        <Button
          leftIcon={<Copy aria-hidden="true" className="size-4" />}
          onClick={() => void copy()}
        >
          Copy password
        </Button>
      </div>
      {copyFailed ? (
        <p role="status" className="text-xs font-medium text-danger">
          Could not copy automatically. Select the password and copy it yourself.
        </p>
      ) : null}
      {closeAttempted ? (
        <p role="alert" className="text-sm font-medium text-text">
          Select Done once you have saved the password. It cannot be shown again.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Shows a temporary password once. The password lives only in the props of this dialog (state
 * of the page that opened it) and is gone when the dialog closes: it is never put in a query
 * cache, the URL, storage, a log or a toast.
 */
export function TemporaryPasswordDialog({ secret, onClose }: TemporaryPasswordDialogProps) {
  const [closeAttempted, setCloseAttempted] = useState(false);
  const done = () => {
    setCloseAttempted(false);
    onClose();
  };
  return (
    <Modal
      open={secret !== null}
      // Escape and the close button explain instead of discarding a password nobody has saved.
      onClose={() => setCloseAttempted(true)}
      title={secret ? TITLE[secret.kind] : 'Temporary password'}
      description={secret ? description(secret) : undefined}
      closeOnBackdrop={false}
      footer={
        <Button variant="primary" onClick={done}>
          Done
        </Button>
      }
    >
      {secret ? <PasswordPanel secret={secret} closeAttempted={closeAttempted} /> : null}
    </Modal>
  );
}
