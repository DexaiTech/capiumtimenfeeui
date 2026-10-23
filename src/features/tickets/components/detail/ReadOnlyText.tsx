import type { LucideIcon } from 'lucide-react';
import { useId } from 'react';

import { RichText } from '@/components/ui';

export interface ReadOnlyTextProps {
  /** "Subject" or "Description": the heading. */
  label: string;
  icon: LucideIcon;
  value: string | null;
  /** Rich text: the sanitised HTML of `value`, null for a plain text written before formatting. */
  valueHtml?: string | null;
  /** Shown in the box while the text is empty. */
  emptyText: string;
}

/**
 * A text of the ticket in a grey box. The subject and the description are written when the
 * ticket is created and cannot be changed afterwards, so there is nothing to edit here.
 */
export function ReadOnlyText({
  label,
  icon: Icon,
  value,
  valueHtml,
  emptyText,
}: ReadOnlyTextProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="flex items-center gap-2 text-sm font-bold text-text">
        <Icon aria-hidden="true" className="size-4 text-text-muted" />
        {label}
      </h2>
      <div className="min-h-10 rounded-md border border-border bg-surface-sunken px-3 py-2.5 text-sm break-words text-text">
        {value ? (
          <RichText html={valueHtml} text={value} />
        ) : (
          <span className="text-text-subtle">{emptyText}</span>
        )}
      </div>
    </section>
  );
}
