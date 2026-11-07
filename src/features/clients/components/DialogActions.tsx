import type { ReactNode } from 'react';

/**
 * The Save and Cancel buttons under a form panel of Clients. They stay at the bottom edge of the
 * screen while a long form scrolls, so saving never means scrolling to the end first. A
 * `FormPanel` opens in the page, so the row sticks to the window (`bottom-0`, its own padding
 * below the buttons). The margins cancel the padding of the panel body (`px-5 py-5`) so the row
 * runs edge to edge and closes the card.
 */
export function DialogActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-5 mt-5 -mb-5 flex flex-col-reverse gap-2 rounded-b-xl border-t border-border bg-surface-raised px-5 py-4 sm:flex-row sm:justify-end">
      {children}
    </div>
  );
}
