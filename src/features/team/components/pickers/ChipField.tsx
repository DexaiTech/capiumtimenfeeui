import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import type { PickerItem } from '../../types';

export interface ChipFieldProps {
  /** Names the group, for example "Clients". */
  label: string;
  items: ReadonlyArray<PickerItem>;
  onRemove: (id: string) => void;
  /** Shown when nothing is chosen yet. */
  emptyText: string;
  error?: string;
  hint?: ReactNode;
  /** The picker that adds one more. */
  children: ReactNode;
}

/** A group of chosen records as removable chips, with the picker that adds another. */
export function ChipField({
  label,
  items,
  onRemove,
  emptyText,
  error,
  hint,
  children,
}: ChipFieldProps) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="text-sm font-medium text-text">{label}</legend>
      {items.length > 0 ? (
        <ul aria-label={`Chosen ${label.toLowerCase()}`} className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <li key={item.id}>
              <span className="inline-flex h-7 max-w-64 items-center gap-1 rounded-full bg-primary-soft pr-1 pl-2.5 text-xs font-medium text-primary-text">
                <span className="truncate">{item.label}</span>
                <button
                  type="button"
                  aria-label={`Remove ${item.label}`}
                  onClick={() => onRemove(item.id)}
                  className="inline-flex size-5 items-center justify-center rounded-full hover:bg-surface-hover"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-text-muted">{emptyText}</p>
      )}
      {children}
      {hint && !error ? <p className="text-xs text-text-muted">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
