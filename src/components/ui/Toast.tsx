import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { toast as toastVariants } from '@/components/common/motion';
import { cn } from '@/utils/cn';

import { ToastContext, type ToastApi, type ToastOptions, type ToastTone } from './toastContext';

interface ToastRecord extends ToastOptions {
  id: string;
}

const DEFAULT_DURATION_MS = 5000;
const MAX_VISIBLE = 4;

const toneStyles: Record<ToastTone, { icon: ReactNode; accent: string }> = {
  success: { icon: <CircleCheck className="size-5" aria-hidden="true" />, accent: 'text-success' },
  error: { icon: <CircleAlert className="size-5" aria-hidden="true" />, accent: 'text-danger' },
  warning: {
    icon: <TriangleAlert className="size-5" aria-hidden="true" />,
    accent: 'text-warning',
  },
  info: { icon: <Info className="size-5" aria-hidden="true" />, accent: 'text-info' },
};

function ToastCard({
  record,
  onDismiss,
}: {
  record: ToastRecord;
  onDismiss: (id: string) => void;
}) {
  const { id, tone = 'info', title, description, action, duration = DEFAULT_DURATION_MS } = record;
  const style = toneStyles[tone];

  useEffect(() => {
    if (duration <= 0) return;
    const timer = window.setTimeout(() => onDismiss(id), duration);
    return () => window.clearTimeout(timer);
  }, [duration, id, onDismiss]);

  return (
    <motion.li
      layout
      variants={toastVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      // Errors interrupt; everything else waits for a pause in speech.
      role={tone === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-border bg-surface shadow-card-raised p-3.5 shadow-lg"
    >
      <span className={cn('mt-0.5 shrink-0', style.accent)}>{style.icon}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-semibold text-text">{title}</p>
        {description ? <p className="text-sm break-words text-text-muted">{description}</p> : null}
        {action ? (
          <button
            type="button"
            onClick={() => {
              action.onClick();
              onDismiss(id);
            }}
            className="mt-1.5 inline-flex min-h-11 items-center self-start rounded-sm text-sm font-semibold text-primary-text hover:underline md:min-h-0"
          >
            {action.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(id)}
        className="-m-2 flex size-11 shrink-0 items-center justify-center rounded-md text-text-subtle hover:text-text md:m-0 md:size-7"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </motion.li>
  );
}

export interface ToastProviderProps {
  children: ReactNode;
}

/** Holds the toast queue and renders the live region. Read it with `useToast()`. */
export function ToastProvider({ children }: ToastProviderProps) {
  const [records, setRecords] = useState<ToastRecord[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setRecords((current) => current.filter((record) => record.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    counter.current += 1;
    const id = `toast-${counter.current}`;
    setRecords((current) => [...current, { ...options, id }].slice(-MAX_VISIBLE));
    return id;
  }, []);

  const api = useMemo<ToastApi>(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <ol
          aria-label="Notifications"
          className={cn(
            'pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-4',
            'md:inset-x-auto md:top-auto md:right-0 md:bottom-0 md:w-96 md:items-end',
          )}
        >
          <AnimatePresence initial={false}>
            {records.map((record) => (
              <ToastCard key={record.id} record={record} onDismiss={dismiss} />
            ))}
          </AnimatePresence>
        </ol>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
