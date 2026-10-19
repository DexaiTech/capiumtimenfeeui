import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AreaChart } from './AreaChart';
import { BarChart } from './BarChart';
import { DonutChart } from './DonutChart';
import { formatMinutes, formatShortDate } from './format';
import { LineChart } from './LineChart';
import type { BaseChartProps } from './types';

vi.mock('./impl/LineChartImpl', () => ({ default: () => <div data-testid="line-impl" /> }));
vi.mock('./impl/AreaChartImpl', () => ({ default: () => <div data-testid="area-impl" /> }));
vi.mock('./impl/BarChartImpl', () => ({
  default: (props: { colorKey?: string; valueLabels?: boolean }) => (
    <div
      data-testid="bar-impl"
      data-color-key={props.colorKey}
      data-value-labels={String(props.valueLabels)}
    />
  ),
}));
vi.mock('./impl/DonutChartImpl', () => ({ default: () => <div data-testid="donut-impl" /> }));

const base: BaseChartProps = {
  title: 'Time per day',
  description: 'Logged minutes',
  data: [
    { day: '2025-10-05', actual: 90, ideal: 120 },
    { day: '2025-10-06', actual: 45, ideal: 100 },
  ],
  xKey: 'day',
  series: [
    { key: 'actual', label: 'Actual', color: 'primary' },
    { key: 'ideal', label: 'Ideal', color: 'muted', dashed: true },
  ],
  xFormatter: (value) => formatShortDate(value),
  yFormatter: formatMinutes,
};

const cartesian = [
  ['LineChart', LineChart, 'line-impl'],
  ['AreaChart', AreaChart, 'area-impl'],
  ['BarChart', BarChart, 'bar-impl'],
] as const;

describe.each(cartesian)('%s', (_name, Chart, implId) => {
  it('renders the lazy implementation once it loads', async () => {
    render(<Chart {...base} />);
    expect(await screen.findByTestId(implId)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Time per day. Logged minutes' })).toBeInTheDocument();
  });

  it('shows the empty state for no data', () => {
    render(<Chart {...base} data={[]} emptyTitle="No time yet" emptyDescription="Log some." />);
    expect(screen.getByText('No time yet')).toBeInTheDocument();
    expect(screen.getByText('Log some.')).toBeInTheDocument();
    expect(screen.queryByTestId(implId)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View as table' })).not.toBeInTheDocument();
  });

  it('shows the skeleton while loading and the error with retry', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<Chart {...base} loading />);
    expect(screen.getByRole('status', { name: 'Loading Time per day' })).toBeInTheDocument();
    rerender(<Chart {...base} error={{ message: 'Boom', requestId: 'r-1' }} onRetry={onRetry} />);
    expect(screen.getByText('r-1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('lists every series in the legend, marking dashed ones', () => {
    render(<Chart {...base} />);
    const items = within(screen.getByRole('list', { name: 'Legend' })).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['Actual', 'Ideal(dashed line)']);
  });

  it('hides the legend for a single series unless asked for', () => {
    const series = base.series.slice(0, 1);
    const { rerender } = render(<Chart {...base} series={series} />);
    expect(screen.queryByRole('list', { name: 'Legend' })).not.toBeInTheDocument();
    rerender(<Chart {...base} series={series} legend />);
    expect(screen.getByRole('list', { name: 'Legend' })).toBeInTheDocument();
  });

  it('formats the table with the x and y formatters', async () => {
    render(<Chart {...base} />);
    await userEvent.click(screen.getByRole('button', { name: 'View as table' }));
    const grid = screen.getByRole('table', { name: 'Time per day' });
    expect(within(grid).getByRole('rowheader', { name: 'Oct 5' })).toBeInTheDocument();
    expect(within(grid).getByRole('cell', { name: '1h 30m' })).toBeInTheDocument();
    expect(within(grid).getByRole('cell', { name: '45m' })).toBeInTheDocument();
    expect(within(grid).getByRole('columnheader', { name: 'Actual' })).toBeInTheDocument();
  });

  it('uses tableColumns to override the table columns', async () => {
    render(
      <Chart
        {...base}
        tableColumns={[
          { key: 'day', label: 'Date' },
          { key: 'actual', label: 'Logged', align: 'end' },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'View as table' }));
    const grid = screen.getByRole('table');
    expect(
      within(grid)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Date', 'Logged']);
  });
});

describe('DonutChart', () => {
  const data = [
    { key: 'a', label: 'Design', value: 90, color: 'violet' as const },
    { key: 'b', label: 'Build', value: 30, color: 'teal' as const },
  ];

  it('renders the implementation and a legend with value and percent', async () => {
    render(<DonutChart title="By area" data={data} valueFormatter={formatMinutes} />);
    expect(await screen.findByTestId('donut-impl')).toBeInTheDocument();
    const items = within(screen.getByRole('list', { name: 'Legend' })).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Design1h 30m · 75%');
    expect(items[1]).toHaveTextContent('Build30m · 25%');
  });

  it('lists label, value and percent in the table', async () => {
    render(<DonutChart title="By area" data={data} valueFormatter={formatMinutes} />);
    await userEvent.click(screen.getByRole('button', { name: 'View as table' }));
    const grid = screen.getByRole('table', { name: 'By area' });
    expect(
      within(grid)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Label', 'Value', 'Percent']);
    const rows = within(grid).getAllByRole('row');
    expect(
      within(rows[1] as HTMLElement)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['1h 30m', '75%']);
    expect(within(rows[2] as HTMLElement).getByRole('rowheader')).toHaveTextContent('Build');
  });

  it('is empty when there is no data or every value is 0', () => {
    const { rerender } = render(<DonutChart title="By area" data={[]} />);
    expect(screen.getByText('No data to show')).toBeInTheDocument();
    rerender(<DonutChart title="By area" data={data.map((item) => ({ ...item, value: 0 }))} />);
    expect(screen.getByText('No data to show')).toBeInTheDocument();
    expect(screen.queryByTestId('donut-impl')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Legend' })).not.toBeInTheDocument();
  });

  it('lists the share the caller already has, and words the detail of the legend as asked', async () => {
    render(
      <DonutChart
        title="By status"
        data={[
          { key: 'open', label: 'Open', value: 5, color: 'warning', share: '1.9%' },
          { key: 'closed', label: 'Closed', value: 251, color: 'success', share: '95.1%' },
        ]}
        legendDetail={(value, share) => `${value} (${share})`}
      />,
    );
    const items = within(screen.getByRole('list', { name: 'Legend' })).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Open5 (1.9%)');
    expect(items[1]).toHaveTextContent('Closed251 (95.1%)');

    // The table says the same: the given share replaces the computed one.
    await userEvent.click(screen.getByRole('button', { name: 'View as table' }));
    const grid = screen.getByRole('table', { name: 'By status' });
    expect(within(grid).getByRole('cell', { name: '1.9%' })).toBeInTheDocument();
    expect(within(grid).getByRole('cell', { name: '95.1%' })).toBeInTheDocument();
  });

  it('keeps the legend under the ring, and beside it in a column when asked', async () => {
    const { rerender } = render(<DonutChart title="By area" data={data} />);
    expect(screen.getByRole('list', { name: 'Legend' })).toHaveClass('flex-wrap');

    rerender(<DonutChart title="By area" data={data} legendPlacement="end" />);
    expect(screen.getByRole('list', { name: 'Legend' })).toHaveClass('flex-col');
    expect(screen.getByRole('img', { name: 'By area' })).toHaveClass('sm:w-1/2');

    // Under the table it is a row again.
    await userEvent.click(screen.getByRole('button', { name: 'View as table' }));
    expect(screen.getByRole('list', { name: 'Legend' })).toHaveClass('flex-wrap');
  });
});

describe('BarChart bars coloured one by one', () => {
  it('hands the colour key and the value labels to the implementation', async () => {
    render(<BarChart {...base} colorKey="color" valueLabels />);
    const impl = await screen.findByTestId('bar-impl');
    expect(impl).toHaveAttribute('data-color-key', 'color');
    expect(impl).toHaveAttribute('data-value-labels', 'true');
  });

  it('leaves both off unless asked for', async () => {
    render(<BarChart {...base} />);
    const impl = await screen.findByTestId('bar-impl');
    expect(impl).not.toHaveAttribute('data-color-key');
    expect(impl).toHaveAttribute('data-value-labels', 'false');
  });
});
