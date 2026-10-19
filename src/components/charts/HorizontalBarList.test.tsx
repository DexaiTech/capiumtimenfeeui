import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { HorizontalBarList } from './HorizontalBarList';

const items = [
  { key: 'bug', label: 'Bug', value: 6, color: 'red' as const },
  { key: 'reporting', label: 'Reporting', value: 3, color: 'green' as const },
  { key: 'others', label: 'Others', value: 0 },
];

const rows = () =>
  within(screen.getByRole('list', { name: 'Tickets by Tag' })).getAllByRole('listitem');

/** The bar inside a row: its width is the share of the largest value. */
const barOf = (row: HTMLElement) => row.querySelector<HTMLElement>('[aria-hidden="true"] > span');

describe('HorizontalBarList', () => {
  it('is a list named by its title: each row is its name and its value as text', () => {
    render(<HorizontalBarList title="Tickets by Tag" items={items} />);
    expect(screen.getByRole('region', { name: 'Tickets by Tag' })).toBeInTheDocument();
    expect(rows().map((row) => row.textContent)).toEqual(['Bug6', 'Reporting3', 'Others0']);
  });

  it('sizes every bar against the largest value', () => {
    render(<HorizontalBarList title="Tickets by Tag" items={items} />);
    const [first, second, third] = rows();
    expect(barOf(first as HTMLElement)).toHaveStyle({ width: '100%' });
    expect(barOf(second as HTMLElement)).toHaveStyle({ width: '50%' });
    expect(barOf(third as HTMLElement)).toHaveStyle({ width: '0%' });
  });

  it("draws a pastel of the bar's colour, the muted grey without one, and hides the bar from assistive technology", () => {
    render(<HorizontalBarList title="Tickets by Tag" items={items} />);
    const [first, , third] = rows();
    expect(barOf(first as HTMLElement)?.getAttribute('style')).toContain(
      'color-mix(in srgb, var(--color-tag-red) 35%, transparent)',
    );
    expect(barOf(third as HTMLElement)?.getAttribute('style')).toContain('var(--color-text-muted)');
    expect(barOf(first as HTMLElement)?.parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('formats the values', () => {
    render(
      <HorizontalBarList
        title="Tickets by Tag"
        items={items.slice(0, 2)}
        valueFormatter={(value) => `${String(value)} tickets`}
      />,
    );
    expect(rows().map((row) => row.textContent)).toEqual(['Bug6 tickets', 'Reporting3 tickets']);
  });

  it('keeps a long name readable in a tooltip', () => {
    render(
      <HorizontalBarList
        title="Tickets by Tag"
        items={[{ key: 'long', label: 'A very long assignee name', value: 1 }]}
      />,
    );
    expect(screen.getByText('A very long assignee name')).toHaveAttribute(
      'title',
      'A very long assignee name',
    );
  });

  it('does not divide by zero when every value is 0', () => {
    render(
      <HorizontalBarList
        title="Tickets by Tag"
        items={[
          { key: 'a', label: 'A', value: 0 },
          { key: 'b', label: 'B', value: 0 },
        ]}
      />,
    );
    for (const row of rows()) expect(barOf(row)).toHaveStyle({ width: '0%' });
  });

  it('shows a skeleton while loading', () => {
    render(<HorizontalBarList title="Tickets by Tag" items={[]} loading />);
    expect(screen.getByRole('status', { name: 'Loading Tickets by Tag' })).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('says so when there is nothing to show', () => {
    const { rerender } = render(<HorizontalBarList title="Tickets by Tag" items={[]} />);
    expect(screen.getByText('No data to show')).toBeInTheDocument();
    rerender(
      <HorizontalBarList
        title="Tickets by Tag"
        items={[]}
        emptyTitle="No tags in this period"
        emptyDescription="Tag tickets to see which kinds come up most."
      />,
    );
    expect(screen.getByText('No tags in this period')).toBeInTheDocument();
    expect(screen.getByText('Tag tickets to see which kinds come up most.')).toBeInTheDocument();
  });

  it('shows the error with its request id and a Retry button', async () => {
    const onRetry = vi.fn();
    render(
      <HorizontalBarList
        title="Tickets by Tag"
        items={items}
        error={{ message: 'Server exploded', requestId: 'req-7' }}
        onRetry={onRetry}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('Server exploded')).toBeInTheDocument();
    expect(within(alert).getByText('req-7')).toBeInTheDocument();
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('renders extra controls in its header', () => {
    render(
      <HorizontalBarList
        title="Tickets by Tag"
        items={items}
        actions={<button type="button">Export</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });
});
