import { ChevronRight } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { cn } from '@/utils/cn';

export interface FormSectionProps {
  title: string;
  /** One line under the title: what the group is for, or that it is optional. */
  description?: ReactNode;
  /** Layout of the fields inside, for example `grid gap-4 sm:grid-cols-2`. */
  className?: string;
  /** A group the person can fold away: for fields most people never need. */
  collapsible?: boolean;
  /** Collapsible groups start open when this is true. */
  defaultOpen?: boolean;
  /** Opens a collapsible group (an error inside it must never stay out of sight). */
  forceOpen?: boolean;
  children: ReactNode;
}

/**
 * A titled group of the fields of a long form. Collapsible groups hold the optional fields, so a
 * new record asks for what it needs first and the rest on request.
 */
export function FormSection({
  title,
  description,
  className,
  collapsible = false,
  defaultOpen = true,
  forceOpen = false,
  children,
}: FormSectionProps) {
  const id = useId();
  // What the person chose (null: nothing yet, so the default); an error inside opens it regardless.
  const [chosen, setChosen] = useState<boolean | null>(null);
  const open = forceOpen || (chosen ?? defaultOpen);

  if (!collapsible) {
    return (
      <section aria-labelledby={id} className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 id={id} className="text-sm font-semibold text-text">
            {title}
          </h3>
          {description ? <p className="text-xs text-text-muted">{description}</p> : null}
        </div>
        <div className={className}>{children}</div>
      </section>
    );
  }

  return (
    <details
      open={open}
      onToggle={(event) => setChosen(event.currentTarget.open)}
      className="group flex flex-col gap-3 rounded-lg border border-border px-4 py-3"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 select-none">
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-text-muted transition-transform group-open:rotate-90"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-text">{title}</span>
          {description ? <span className="text-xs text-text-muted">{description}</span> : null}
        </span>
      </summary>
      <div className={cn('pt-1', className)}>{children}</div>
    </details>
  );
}
