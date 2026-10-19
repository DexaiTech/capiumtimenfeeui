import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

export type NoticeTone = 'info' | 'success' | 'warning' | 'danger';

const STYLE: Record<NoticeTone, string> = {
  info: 'border-info/30 bg-info-soft',
  success: 'border-success/30 bg-success-soft',
  warning: 'border-warning/40 bg-warning-soft',
  danger: 'border-danger/40 bg-danger-soft',
};

const ICON: Record<NoticeTone, typeof Info> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
};

const ICON_COLOUR: Record<NoticeTone, string> = {
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

export interface NoticeProps {
  tone: NoticeTone;
  title: string;
  children?: ReactNode;
  /** A button or link at the end. */
  action?: ReactNode;
  /** `alert` interrupts assistive technology; the default `status` is polite. */
  role?: 'status' | 'alert';
  className?: string;
}

/** A banner with an icon, a bold line and optional detail: the colour is never the only signal. */
export function Notice({ tone, title, children, action, role = 'status', className }: NoticeProps) {
  const Icon = ICON[tone];
  return (
    <div
      role={role}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm text-text',
        STYLE[tone],
        className,
      )}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', ICON_COLOUR[tone])} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="font-medium">{title}</p>
        {children ? <div className="text-xs text-text-muted">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
