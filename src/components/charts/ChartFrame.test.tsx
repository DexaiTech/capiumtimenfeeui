import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ChartFrame } from './ChartFrame';
import type { ChartLegendItem, ChartTableData } from './types';

const table: ChartTableData = {
  caption: 'Hours per day',
  columns: [
    { key: 'day', label: 'Day' },
    { key: 'hours', label: 'Hours', align: 'end' },
  ],
  rows: [
    { day: 'Oct 5', hours: '1h 30m' },
    { day: 'Oct 6', hours: null },
  ],
};

function renderFrame(props: Partial<React.ComponentProps<typeof ChartFrame>> = {}) {
  return render(
    <ChartFrame title="Hours" description="Hours logged per day" table={table} {...props}>
      <div data-testid="chart" />
    </ChartFrame>,
  );
}

describe('ChartFrame', () => {
  it('renders a section named by its title with the chart as a labelled image', () => {
    renderFrame();
    expect(screen.getByRole('region', { name: 'Hours' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Hours. Hours logged per day' })).toContainElement(
      screen.getByTestId('chart'),
    );
  });

  it('reserves the box size from the aspect ratio with a minimum height', () => {
    renderFrame({ aspect: 2 });
    const box = screen.getByRole('img');
    expect(box).toHaveStyle({ aspectRatio: '2', minHeight: '220px' });
  });

  describe('states', () => {
    it('shows a same-size loading skeleton as a status', () => {
      renderFrame({ state: 'loading' });
      expect(screen.getByRole('status', { name: 'Loading Hours' })).toBeInTheDocument();
      expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'View as table' })).not.toBeInTheDocument();
    });

    it('shows the empty title and description without a table toggle', () => {
      renderFrame({
        state: 'empty',
        emptyTitle: 'Nothing logged',
        emptyDescription: 'Log time to see it here.',
      });
      expect(screen.getByText('Nothing logged')).toBeInTheDocument();
      expect(screen.getByText('Log time to see it here.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'View as table' })).not.toBeInTheDocument();
      expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
    });

    it('shows the error, its request id and a Retry button', async () => {
      const onRetry = vi.fn();
      renderFrame({
        state: 'error',
        error: { message: 'Server exploded', requestId: 'req-42' },
        onRetry,
      });
      const alert = screen.getByRole('alert');
      expect(within(alert).getByText('Server exploded')).toBeInTheDocument();
      expect(within(alert).getByText('req-42')).toBeInTheDocument();
      await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('omits Retry when there is no handler', () => {
      renderFrame({ state: 'error', error: { message: 'Nope' } });
      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    });
  });

  describe('View as table', () => {
    it('swaps the chart for a table and back', async () => {
      renderFrame();
      const toggle = screen.getByRole('button', { name: 'View as table' });
      expect(toggle).toHaveAttribute('aria-pressed', 'false');

      await userEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
      const grid = screen.getByRole('table', { name: 'Hours per day' });
      expect(within(grid).getByRole('columnheader', { name: 'Day' })).toHaveAttribute(
        'scope',
        'col',
      );
      expect(within(grid).getByRole('columnheader', { name: 'Hours' })).toBeInTheDocument();
      expect(within(grid).getByRole('rowheader', { name: 'Oct 5' })).toBeInTheDocument();
      expect(within(grid).getByRole('cell', { name: '1h 30m' })).toBeInTheDocument();
      expect(within(grid).getByRole('cell', { name: '—' })).toBeInTheDocument();

      await userEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.getByTestId('chart')).toBeInTheDocument();
    });
  });

  describe('legend', () => {
    const legend: ChartLegendItem[] = [
      { id: 'actual', label: 'Actual', color: 'var(--color-primary)' },
      { id: 'ideal', label: 'Ideal', color: 'var(--color-text-muted)', dashed: true },
    ];

    it('lists the series and describes dashed ones in text', () => {
      renderFrame({ legend });
      const list = screen.getByRole('list', { name: 'Legend' });
      const items = within(list).getAllByRole('listitem');
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveTextContent('Actual');
      expect(items[0]).not.toHaveTextContent('dashed');
      expect(items[1]).toHaveTextContent('Ideal');
      expect(items[1]).toHaveTextContent('(dashed line)');
    });

    it('is not rendered when empty', () => {
      renderFrame({ legend: [] });
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });
  });

  it('renders extra actions in the header', () => {
    renderFrame({ actions: <button type="button">Export</button> });
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });
});
