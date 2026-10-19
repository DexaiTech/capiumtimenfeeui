import type { ReactNode } from 'react';

export interface AuthHeadingProps {
  title: string;
  children?: ReactNode;
}

export function AuthHeading({ title, children }: AuthHeadingProps) {
  return (
    <div className="mb-6 flex flex-col gap-1.5">
      <h1 className="text-2xl font-semibold tracking-tight text-text">{title}</h1>
      {children ? <p className="text-sm text-text-muted">{children}</p> : null}
    </div>
  );
}

export function AuthFooterLink({ children }: { children: ReactNode }) {
  return <p className="mt-6 text-center text-sm text-text-muted">{children}</p>;
}

export const authLinkClasses = 'rounded-sm font-medium text-primary-text hover:underline';
