import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

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

  // Opens in the page flow, so bring it into view and put the cursor in the first field.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    node.querySelector<HTMLElement>(FIELD)?.focus({ preventScroll: true });
  }, []);

  return (
    <section
      ref={ref}
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
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
            onClick={onClose}
            className="-mt-1 -mr-2"
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
        </header>
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
