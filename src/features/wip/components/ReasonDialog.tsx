import { useState, type ReactNode } from 'react';

import { ConfirmDialog, Textarea } from '@/components/ui';

import { REASON_MAX } from '../constants';

export interface ReasonDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  confirmLabel: string;
  tone?: 'danger' | 'default';
  /** What the text is called: "Reason" or "Note". */
  label?: string;
  /** A reason is required before the action may be confirmed; a note is optional. */
  required?: boolean;
  loading: boolean;
  /** A refusal of the API, explained in place so the dialog can stay open. */
  error: { message: string; requestId?: string } | null;
  onSubmit: (text: string) => void;
  /** What will happen, above the text. */
  children?: ReactNode;
}

/** A confirmation that asks for a reason (or an optional note) to send with the action. */
export function ReasonDialog({
  open,
  onClose,
  title,
  confirmLabel,
  tone = 'default',
  label = 'Reason',
  required = true,
  loading,
  error,
  onSubmit,
  children,
}: ReasonDialogProps) {
  const [text, setText] = useState('');
  const trimmed = text.trim();
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={() => onSubmit(trimmed)}
      title={title}
      confirmLabel={confirmLabel}
      tone={tone}
      loading={loading}
      confirmDisabled={required && trimmed === ''}
      error={error}
    >
      {children}
      <Textarea
        label={label}
        rows={3}
        maxLength={REASON_MAX}
        value={text}
        hint={required ? undefined : 'Optional'}
        onChange={(event) => setText(event.target.value)}
      />
    </ConfirmDialog>
  );
}
