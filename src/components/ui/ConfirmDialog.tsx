import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from './Button';
import { Modal } from './Modal';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  /** What will happen, in a sentence or two. */
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
  /** True while the confirmed action runs. */
  loading?: boolean;
  confirmDisabled?: boolean;
  /** A refusal explained in place, so the dialog can stay open. */
  error?: ConfirmDialogError | null;
}

export interface ConfirmDialogError {
  message: string;
  requestId?: string;
  /** What the refusal is about, one line each (for example the rows a bulk action refused). */
  items?: ReadonlyArray<{ label: string; reason: string }>;
}

/** A small confirmation modal for destructive or far-reaching actions. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
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
          <Button onClick={onClose}>{cancelLabel}</Button>
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
        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-md border border-danger/40 bg-danger-soft px-3 py-2.5 text-sm text-text"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
            <div className="flex min-w-0 flex-col gap-1">
              <p>{error.message}</p>
              {error.items && error.items.length > 0 ? (
                <ul className="flex max-h-40 list-disc flex-col gap-0.5 overflow-y-auto pl-4 text-xs">
                  {error.items.map((item) => (
                    <li key={`${item.label}:${item.reason}`}>
                      <span className="font-semibold">{item.label}</span>: {item.reason}
                    </li>
                  ))}
                </ul>
              ) : null}
              {error.requestId ? (
                <p className="text-xs text-text-muted">
                  Request ID: <code className="font-mono break-all">{error.requestId}</code>
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
