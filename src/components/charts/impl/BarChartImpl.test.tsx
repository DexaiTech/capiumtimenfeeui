import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import BarChartImpl from './BarChartImpl';

const data = [
  { priority: 'High', count: 4, color: 'danger' },
  { priority: 'Medium', count: 4, color: 'orange' },
  { priority: 'Low', count: 3, color: 'success' },
  { priority: 'Not Set', count: 5, color: 'muted' },
];

const props = {
  data,
  xKey: 'priority',
  series: [{ key: 'count', label: 'Tickets', color: 'primary' as const }],
  xFormatter: (value: string | number) => String(value),
  yFormatter: (value: number) => String(value),
  animate: false,
  stacked: false,
  horizontal: false,
  valueLabels: false,
};

/** jsdom has no layout: a ResizeObserver that reports a fixed size lets the chart draw. */
class FixedSizeObserver {
  private readonly callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    const entry = { target, contentRect: { width: 400, height: 260 } } as ResizeObserverEntry;
    this.callback([entry], this);
  }
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  globalThis.ResizeObserver = FixedSizeObserver;
});
afterEach(() => {
  Reflect.deleteProperty(globalThis, 'ResizeObserver');
});

const fills = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('.recharts-bar-rectangle path')).map((bar) =>
    bar.getAttribute('fill'),
  );

describe('BarChartImpl', () => {
  it('draws every bar in the colour of its series', () => {
    const { container } = render(<BarChartImpl {...props} />);
    expect(fills(container)).toEqual(Array(4).fill('var(--color-primary)'));
  });

  it('colours the bars of one series one by one from the datum when colorKey is given', () => {
    const { container } = render(<BarChartImpl {...props} colorKey="color" />);
    expect(fills(container)).toEqual([
      'var(--color-danger)',
      'var(--color-tag-orange)',
      'var(--color-success)',
      'var(--color-text-muted)',
    ]);
  });

  it('prints each value above its bar only when asked to', () => {
    const plain = render(<BarChartImpl {...props} />);
    expect(plain.container.querySelectorAll('.recharts-label-list text')).toHaveLength(0);
    plain.unmount();

    const labelled = render(<BarChartImpl {...props} valueLabels />);
    expect(
      Array.from(labelled.container.querySelectorAll('.recharts-label-list text')).map(
        (label) => label.textContent,
      ),
    ).toEqual(['4', '4', '3', '5']);
  });
});
