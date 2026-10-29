import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/utils/cn';

export type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

export interface TooltipProps {
  content: ReactNode;
  side?: TooltipSide;
  /** When true the tooltip never opens (for example when the label is already visible). */
  disabled?: boolean;
  /** Classes of the element that wraps the trigger (it is inline by default). */
  className?: string;
  /** One focusable element; it receives `aria-describedby`. */
  children: ReactElement<{ 'aria-describedby'?: string }>;
}

const GAP = 8;

const transforms: Record<TooltipSide, string> = {
  top: '-translate-x-1/2 -translate-y-full',
  bottom: '-translate-x-1/2',
  left: '-translate-x-full -translate-y-1/2',
  right: '-translate-y-1/2',
};

function anchorPoint(rect: DOMRect, side: TooltipSide): { top: number; left: number } {
  switch (side) {
    case 'top':
      return { top: rect.top - GAP, left: rect.left + rect.width / 2 };
    case 'bottom':
      return { top: rect.bottom + GAP, left: rect.left + rect.width / 2 };
    case 'left':
      return { top: rect.top + rect.height / 2, left: rect.left - GAP };
    case 'right':
      return { top: rect.top + rect.height / 2, left: rect.right + GAP };
  }
}

/** Shows on hover and on keyboard focus; Escape hides it. Rendered in a portal so nothing clips it. */
export function Tooltip({
  content,
  side = 'top',
  disabled = false,
  className = 'inline-flex',
  children,
}: TooltipProps) {
  const id = useId();
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const show = useCallback(() => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (rect && !disabled) setPosition(anchorPoint(rect, side));
  }, [disabled, side]);
  const hide = useCallback(() => setPosition(null), []);

  const open = position !== null && !disabled;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', hide, true);
    };
  }, [open, hide]);

  return (
    <span
      ref={wrapperRef}
      className={className}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {cloneElement(children, { 'aria-describedby': open ? id : undefined })}
      {open && position
        ? createPortal(
            <span
              id={id}
              role="tooltip"
              style={{ top: position.top, left: position.left }}
              className={cn(
                'pointer-events-none fixed z-[70] max-w-60 rounded-sm border border-border bg-surface-raised px-2 py-1',
                'text-xs font-medium text-text shadow-md',
                transforms[side],
              )}
            >
              {content}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
