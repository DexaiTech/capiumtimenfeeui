import type { ReactNode } from 'react';

import { FormAlert } from '@/components/forms';
import { Button, Modal } from '@/components/ui';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'default';
  loading?: boolean;
  /** Disables the confirm button when the action is known to be refused. */
  confirmDisabled?: boolean;
  /** A refusal from the server, explained in place so the dialog can stay open. */
  error?: { message: string; requestId?: string } | null;
}

/** A small confirmation modal for destructive or far-reaching actions. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel,
  tone = 'danger',
  loading = false,
  confirmDisabled = false,
  error,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            loading={loading}
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm text-text-muted">
        {children}
        {error ? <FormAlert message={error.message} requestId={error.requestId} /> : null}
      </div>
    </Modal>
  );
}
