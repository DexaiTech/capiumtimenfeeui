import type { ReactNode } from 'react';

/**
 * The buttons under a form in a dialog. They stay at the bottom edge of the dialog while a long
 * form scrolls. The offsets cancel the padding of the dialog body (`px-5 md:px-6`, `pb-5`).
 */
export function DialogActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky -bottom-5 z-10 -mx-5 mt-5 -mb-5 flex flex-col-reverse gap-2 border-t border-border bg-surface-raised px-5 py-4 sm:flex-row sm:justify-end md:-mx-6 md:px-6">
      {children}
    </div>
  );
}
