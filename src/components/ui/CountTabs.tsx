import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

import { cn } from '@/utils/cn';

/** Width of the fade + arrow over each end of the strip (`w-10`). */
const EDGE_PX = 40;

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
 * soft violet counter. Arrow keys move between tabs. When the tabs do not fit, the strip scrolls
 * with a fade and an arrow over each hidden side, and the selected tab is kept in view.
 */
export function CountTabs<TValue extends string = string>({
  items,
  value,
  onChange,
  label,
  className,
}: CountTabsProps<TValue>) {
  const listRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const updateEdges = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const start = list.scrollLeft > 1;
    const end = list.scrollWidth - list.clientWidth - list.scrollLeft > 1;
    setEdges((current) =>
      current.start === start && current.end === end ? current : { start, end },
    );
  }, []);

  // The counts arrive after the first render and widen the tabs: measure again when they do.
  const counts = items.map((item) => item.count ?? '').join('|');

  // Keep the selected tab in view (deep links to a late tab, keyboard moves). Not
  // `scrollIntoView`: it could scroll the page too.
  useLayoutEffect(() => {
    const list = listRef.current;
    const tab = list?.querySelector<HTMLElement>(`[data-tab="${value}"]`);
    if (!list || !tab) return;
    const left = tab.offsetLeft;
    const right = left + tab.offsetWidth;
    if (left < list.scrollLeft + EDGE_PX) {
      list.scrollLeft = Math.max(0, left - EDGE_PX);
    } else if (right > list.scrollLeft + list.clientWidth - EDGE_PX) {
      list.scrollLeft = right - list.clientWidth + EDGE_PX;
    }
  }, [value, counts]);

  // After every render (counts arriving widen the tabs); state only changes when an edge does.
  useLayoutEffect(updateEdges);

  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(list);
    return () => observer.disconnect();
  }, [updateEdges]);

  const page = (direction: 1 | -1) => {
    const list = listRef.current;
    if (!list) return;
    list.scrollBy({ left: direction * list.clientWidth * 0.8, behavior: 'smooth' });
  };

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
      className={cn(
        'relative flex max-w-full min-w-0 items-center rounded-md border border-border bg-surface',
        className,
      )}
    >
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        onScroll={updateEdges}
        className="relative flex min-w-0 items-center gap-1 overflow-x-auto px-[5px] py-0.5"
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
      {edges.start ? <ScrollEdge side="start" onClick={() => page(-1)} /> : null}
      {edges.end ? <ScrollEdge side="end" onClick={() => page(1)} /> : null}
    </div>
  );
}

/**
 * A fade over one end of an overflowing strip with an arrow that pages it. Hidden from assistive
 * technology and out of the tab order: the arrow keys already reach every tab, and focus scrolls
 * the tab into view.
 */
function ScrollEdge({ side, onClick }: { side: 'start' | 'end'; onClick: () => void }) {
  const Icon = side === 'start' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden="true"
      onClick={onClick}
      className={cn(
        'absolute inset-y-0 flex w-10 items-center from-surface from-40% to-transparent text-brand-text',
        side === 'start'
          ? 'start-0 justify-start rounded-s-md bg-linear-to-r ps-1'
          : 'end-0 justify-end rounded-e-md bg-linear-to-l pe-1',
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}
