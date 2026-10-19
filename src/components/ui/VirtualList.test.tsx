import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { VirtualList } from './VirtualList';
import { computeWindow } from './virtualWindow';

describe('computeWindow', () => {
  it.each([
    // scrollTop, viewport, itemHeight, count, overscan → start, end, offsetTop, totalHeight
    ['the top of the list', 0, 400, 40, 1000, 5, 0, 16, 0, 40_000],
    ['the middle', 4000, 400, 40, 1000, 5, 95, 116, 3800, 40_000],
    ['a partly scrolled row', 4010, 400, 40, 1000, 0, 100, 111, 4000, 40_000],
    ['the bottom', 39_600, 400, 40, 1000, 5, 985, 1000, 39_400, 40_000],
    ['beyond the bottom (clamped)', 99_999, 400, 40, 1000, 5, 985, 1000, 39_400, 40_000],
    ['a negative offset (clamped)', -50, 400, 40, 1000, 5, 0, 16, 0, 40_000],
    ['a list shorter than the viewport', 0, 400, 40, 3, 5, 0, 3, 0, 120],
    ['an empty list', 0, 400, 40, 0, 5, 0, 0, 0, 0],
  ])('%s', (_name, scrollTop, viewport, height, count, overscan, start, end, offsetTop, total) => {
    expect(computeWindow(scrollTop, viewport, height, count, overscan)).toEqual({
      start,
      end,
      offsetTop,
      totalHeight: total,
    });
  });
});

describe('VirtualList', () => {
  const items = Array.from({ length: 500 }, (_, index) => ({
    id: `row-${index}`,
    name: `Row ${index}`,
  }));

  function renderList(onEndReached?: () => void) {
    return render(
      <VirtualList
        items={items}
        itemHeight={40}
        itemKey={(item) => item.id}
        renderItem={(item) => <span>{item.name}</span>}
        label="Rows"
        overscan={2}
        onEndReached={onEndReached}
        className="h-96"
      />,
    );
  }

  it('renders only a window of the rows and still reports the full size', () => {
    renderList();
    const rows = screen.getAllByRole('listitem');
    // jsdom has no layout: the fallback viewport (640 px) holds 17 rows, plus the overscan.
    expect(rows.length).toBeLessThan(30);
    expect(rows[0]).toHaveAttribute('aria-posinset', '1');
    expect(rows[0]).toHaveAttribute('aria-setsize', '500');
    expect(screen.getByText('Row 0')).toBeInTheDocument();
    expect(screen.queryByText('Row 100')).toBeNull();
    expect(screen.getByRole('list', { name: 'Rows' })).toHaveStyle({ height: '20000px' });
  });

  it('moves the window when the box scrolls', () => {
    const { container } = renderList();
    const box = container.firstElementChild as HTMLElement;
    Object.defineProperty(box, 'scrollTop', { value: 4000, configurable: true });
    fireEvent.scroll(box);
    expect(screen.queryByText('Row 0')).toBeNull();
    expect(screen.getByText('Row 100')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')[0]).toHaveAttribute('aria-posinset', '99');
  });

  it('reports the end once, when the last rows come into view', () => {
    const onEndReached = vi.fn();
    const { container } = renderList(onEndReached);
    expect(onEndReached).not.toHaveBeenCalled();
    const box = container.firstElementChild as HTMLElement;
    Object.defineProperty(box, 'scrollTop', { value: 500 * 40, configurable: true });
    fireEvent.scroll(box);
    expect(screen.getByText('Row 499')).toBeInTheDocument();
    expect(onEndReached).toHaveBeenCalledTimes(1);
  });
});
