import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

export type AuthStatusTone = 'primary' | 'success' | 'danger';

export interface AuthStatusPanelProps {
  icon: ReactNode;
  tone?: AuthStatusTone;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}

const tones: Record<AuthStatusTone, string> = {
  primary: 'bg-primary-soft text-primary-text',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
};

/** The icon-title-text-actions block used by every non-form state of the auth pages. */
export function AuthStatusPanel({
  icon,
  tone = 'primary',
  title,
  children,
  actions,
}: AuthStatusPanelProps) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span
        aria-hidden="true"
        className={cn('flex size-14 items-center justify-center rounded-xl', tones[tone])}
      >
        {icon}
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-text">{title}</h1>
      {children ? (
        <div className="flex flex-col gap-2 text-sm text-text-muted">{children}</div>
      ) : null}
      {actions ? <div className="mt-2 flex w-full flex-col gap-2.5">{actions}</div> : null}
    </div>
  );
}
