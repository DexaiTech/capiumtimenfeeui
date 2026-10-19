import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/utils/cn';

import { computeWindow } from './virtualWindow';

export interface VirtualListProps<TItem> {
  items: readonly TItem[];
  /** Height of every row in pixels. Rows must not grow beyond it. */
  itemHeight: number;
  itemKey: (item: TItem, index: number) => string;
  renderItem: (item: TItem, index: number) => ReactNode;
  /** Accessible name of the list. */
  label: string;
  /** Rows rendered beyond the visible ones, on each side. */
  overscan?: number;
  /** Called when the last rows come into view (load the next page). */
  onEndReached?: () => void;
  /** Size utilities for the scrolling box; it needs a height (for example `h-[70dvh]`). */
  className?: string;
  /** Rendered after the last row, inside the scrolling box (a loading row, the end marker). */
  footer?: ReactNode;
}

const FALLBACK_VIEWPORT = 640;

/**
 * A windowed list for long, flat collections: only the rows near the viewport are in the DOM.
 * Rows have a fixed height; each row gets `aria-posinset`/`aria-setsize`, so assistive
 * technology still knows the full size.
 */
export function VirtualList<TItem>({
  items,
  itemHeight,
  itemKey,
  renderItem,
  label,
  overscan = 6,
  onEndReached,
  className,
  footer,
}: VirtualListProps<TItem>) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(FALLBACK_VIEWPORT);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setViewport(box.clientHeight || FALLBACK_VIEWPORT);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const range = computeWindow(scrollTop, viewport, itemHeight, items.length, overscan);
  const atEnd = items.length > 0 && range.end >= items.length;

  const endReached = useRef(onEndReached);
  useEffect(() => {
    endReached.current = onEndReached;
  });
  useEffect(() => {
    if (atEnd) endReached.current?.();
  }, [atEnd, items.length]);

  return (
    <div
      ref={boxRef}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      className={cn('overflow-y-auto overscroll-contain', className)}
    >
      <div
        role="list"
        aria-label={label}
        style={{ height: range.totalHeight, position: 'relative' }}
      >
        <div style={{ transform: `translateY(${range.offsetTop}px)` }}>
          {items.slice(range.start, range.end).map((item, offset) => {
            const index = range.start + offset;
            return (
              <div
                key={itemKey(item, index)}
                role="listitem"
                aria-posinset={index + 1}
                aria-setsize={items.length}
                style={{ height: itemHeight }}
              >
                {renderItem(item, index)}
              </div>
            );
          })}
        </div>
      </div>
      {footer}
    </div>
  );
}
