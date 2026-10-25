import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/utils/cn';

import { Button } from './Button';
import { Card } from './Card';

export interface FormPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
}

const FIELD =
  'input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled)';

function Panel({
  onClose,
  title,
  description,
  footer,
  className,
  children,
}: Omit<FormPanelProps, 'open'>) {
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  // Set by the first edit; Escape and the close button then ask before throwing the text away.
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Opens in the page flow, so bring it into view and put the cursor in the first field. When it
  // closes, the focus goes back to what opened it (the button), not to the top of the page.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    node.querySelector<HTMLElement>(FIELD)?.focus({ preventScroll: true });
    return () => {
      const active = document.activeElement;
      const lost = active === document.body || (active !== null && node.contains(active));
      if (opener && opener !== document.body && opener.isConnected && lost) {
        opener.focus({ preventScroll: true });
      }
    };
  }, []);

  useEffect(() => {
    if (confirming) ref.current?.querySelector<HTMLElement>('[data-keep-editing]')?.focus();
  }, [confirming]);

  const requestClose = () => {
    if (dirty) setConfirming(true);
    else onClose();
  };

  return (
    <section
      ref={ref}
      aria-labelledby={titleId}
      onInput={() => setDirty(true)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.stopPropagation();
          requestClose();
        } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          // Ctrl/Cmd+Enter saves from any field, as in mail and chat.
          const form = ref.current?.querySelector('form');
          if (form) {
            event.preventDefault();
            form.requestSubmit();
          }
        }
      }}
      className={cn('scroll-mt-4', className)}
    >
      <Card padding="none" variant="raised">
        <header className="flex items-start justify-between gap-4 border-b border-row-border px-5 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id={titleId} className="text-base font-semibold text-text">
              {title}
            </h2>
            {description ? <p className="text-xs text-text-muted">{description}</p> : null}
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Close ${title}`}
            onClick={requestClose}
            className="-mt-1 -mr-2"
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
        </header>
        {confirming ? (
          <div
            role="alert"
            className="flex flex-col gap-2 border-b border-row-border bg-surface-sunken px-5 py-3 text-sm text-text sm:flex-row sm:items-center sm:justify-between"
          >
            <span>Discard what you typed?</span>
            <span className="flex gap-2">
              <Button size="sm" data-keep-editing onClick={() => setConfirming(false)}>
                Keep editing
              </Button>
              <Button size="sm" variant="danger" onClick={onClose}>
                Discard
              </Button>
            </span>
          </div>
        ) : null}
        {children ? <div className="px-5 py-5">{children}</div> : null}
        {footer ? (
          <footer className="flex flex-col-reverse gap-2 border-t border-row-border px-5 py-4 sm:flex-row sm:justify-end">
            {footer}
          </footer>
        ) : null}
      </Card>
    </section>
  );
}

/**
 * Create/edit form that opens in the page flow instead of over it. Takes the props of `Modal`, so
 * a form moves from one to the other by swapping the shell; render it above the content it edits.
 * No portal, backdrop, scroll lock or focus trap: the page behind stays usable.
 */
export function FormPanel({ open, ...panelProps }: FormPanelProps) {
  return open ? <Panel {...panelProps} /> : null;
}
