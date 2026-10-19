export interface WindowRange {
  /** Index of the first rendered item. */
  start: number;
  /** Index after the last rendered item. */
  end: number;
  /** Height of the space before the first rendered item. */
  offsetTop: number;
  /** Height of all items. */
  totalHeight: number;
}

/**
 * Which items of a fixed-height list to render for a scroll position: the visible ones plus
 * `overscan` on each side.
 */
export function computeWindow(
  scrollTop: number,
  viewportHeight: number,
  itemHeight: number,
  count: number,
  overscan = 6,
): WindowRange {
  const totalHeight = count * itemHeight;
  if (count === 0 || itemHeight <= 0) return { start: 0, end: 0, offsetTop: 0, totalHeight: 0 };
  const top = Math.max(0, Math.min(scrollTop, Math.max(0, totalHeight - viewportHeight)));
  const first = Math.floor(top / itemHeight);
  const visible = Math.ceil(viewportHeight / itemHeight) + 1;
  const start = Math.max(0, first - overscan);
  const end = Math.min(count, first + visible + overscan);
  return { start, end, offsetTop: start * itemHeight, totalHeight };
}
