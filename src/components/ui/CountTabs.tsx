import { useRef, type KeyboardEvent } from 'react';

import { cn } from '@/utils/cn';

export interface CountTab<TValue extends string = string> {
  value: TValue;
  label: string;
  /** Shown in the pill after the label; omitted while unknown. */
  count?: number | null;
}

export interface CountTabsProps<TValue extends string = string> {
  items: ReadonlyArray<CountTab<TValue>>;
  value: TValue;
  onChange?: (value: TValue) => void;
  /** Accessible name of the tab list, for example "Client lists". */
  label: string;
  className?: string;
}

/**
 * The tab switch of a list toolbar: "Clients 12", "Users 18" in a bordered box. The selected
 * tab is a solid violet pill with a translucent counter; the others are violet text with a
 * soft violet counter. Arrow keys move between tabs.
 */
export function CountTabs<TValue extends string = string>({
  items,
  value,
  onChange,
  label,
  className,
}: CountTabsProps<TValue>) {
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((item) => item.value === value);
    let next: CountTab<TValue> | undefined;
    if (event.key === 'ArrowRight') next = items[(index + 1) % items.length];
    else if (event.key === 'ArrowLeft') next = items[(index - 1 + items.length) % items.length];
    else if (event.key === 'Home') next = items[0];
    else if (event.key === 'End') next = items[items.length - 1];
    if (!next) return;
    event.preventDefault();
    onChange?.(next.value);
    listRef.current?.querySelector<HTMLElement>(`[data-tab="${next.value}"]`)?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        'flex max-w-full min-w-0 shrink-0 items-center gap-1 overflow-x-auto rounded-md border border-border bg-surface px-[5px] py-0.5',
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            data-tab={item.value}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange?.(item.value)}
            className={cn(
              'inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-medium whitespace-nowrap md:h-[27px]',
              'transition-colors duration-fast ease-standard',
              selected ? 'bg-brand text-brand-fg' : 'text-brand-text hover:bg-brand-soft',
            )}
          >
            {item.label}
            {item.count === undefined || item.count === null ? null : (
              <span
                className={cn(
                  'inline-flex h-4 min-w-5 items-center justify-center rounded-full px-1.5 text-2xs font-medium tabular-nums',
                  selected ? 'bg-white/20 text-brand-fg' : 'bg-brand-soft text-brand-text',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
