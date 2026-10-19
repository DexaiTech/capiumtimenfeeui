import { useRef, type KeyboardEvent, type ReactNode } from 'react';

import { cn } from '@/utils/cn';

export interface TabItem<TValue extends string = string> {
  value: TValue;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps<TValue extends string = string> {
  items: ReadonlyArray<TabItem<TValue>>;
  value: TValue;
  onChange: (value: TValue) => void;
  /** Accessible name of the tab list. */
  label: string;
  /** Prefix for tab ids, so a panel can point at its tab with `aria-labelledby={`${idBase}-tab-${value}`}`. */
  idBase?: string;
  className?: string;
}

/** Tab list with roving focus: arrow keys move and activate, Home and End jump. */
export function Tabs<TValue extends string = string>({
  items,
  value,
  onChange,
  label,
  idBase = 'tabs',
  className,
}: TabsProps<TValue>) {
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = items.filter((item) => !item.disabled);
    const index = enabled.findIndex((item) => item.value === value);
    let next: TabItem<TValue> | undefined;
    if (event.key === 'ArrowRight') next = enabled[(index + 1) % enabled.length];
    else if (event.key === 'ArrowLeft')
      next = enabled[(index - 1 + enabled.length) % enabled.length];
    else if (event.key === 'Home') next = enabled[0];
    else if (event.key === 'End') next = enabled[enabled.length - 1];
    if (!next) return;
    event.preventDefault();
    onChange(next.value);
    listRef.current?.querySelector<HTMLElement>(`[data-tab="${next.value}"]`)?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('flex gap-1 overflow-x-auto border-b border-border', className)}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`${idBase}-tab-${item.value}`}
            data-tab={item.value}
            aria-selected={selected}
            aria-controls={`${idBase}-panel-${item.value}`}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={cn(
              '-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 rounded-t-sm border-b-2 px-3 text-sm font-medium',
              'transition-colors duration-fast ease-standard disabled:pointer-events-none disabled:opacity-55',
              selected
                ? 'border-primary text-text'
                : 'border-transparent text-text-muted hover:border-border-strong hover:text-text',
            )}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
