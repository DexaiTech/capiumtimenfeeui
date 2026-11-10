import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CountTabs } from './CountTabs';
import { DataTable, type DataTableColumn } from './DataTable';
import { sortRows } from './sortRows';
import { healthTone } from './health';
import { HealthBar } from './HealthBar';
import { avatarColorIndex } from './avatarColor';
import { InitialsAvatar } from './InitialsAvatar';

interface Row {
  id: string;
  name: string;
  fee: number | null;
}

const rows: Row[] = [
  { id: 'a', name: 'Beta Ltd', fee: 300 },
  { id: 'b', name: 'alpha & Co', fee: null },
  { id: 'c', name: 'Gamma LLP', fee: 100 },
];

const columns: DataTableColumn<Row>[] = [
  {
    id: 'name',
    header: 'Name',
    sortable: true,
    sortValue: (row) => row.name,
    cell: (row) => row.name,
  },
  { id: 'fee', header: 'Fee', sortable: true, sortValue: (row) => row.fee, cell: (row) => row.fee },
];

describe('HealthBar', () => {
  it('shows the score out of 100 as a meter, clamped', () => {
    render(<HealthBar score={84} label="Client health" />);
    expect(screen.getByRole('meter', { name: 'Client health' })).toHaveAttribute(
      'aria-valuenow',
      '84',
    );
    expect(screen.getByText('84')).toBeInTheDocument();
  });

  it('clamps and colours by band', () => {
    render(<HealthBar score={140} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '100');
    expect(healthTone(60)).toBe('good');
    expect(healthTone(59)).toBe('fair');
    expect(healthTone(40)).toBe('fair');
    expect(healthTone(39)).toBe('poor');
  });

  it('shows a dash without a score', () => {
    render(<HealthBar score={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('InitialsAvatar', () => {
  it('derives initials from the name, or uses the given ones', () => {
    render(
      <>
        <InitialsAvatar name="Ada Lovelace" />
        <InitialsAvatar name="Grace Brewster Hopper" initials="gbh" />
      </>,
    );
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveTextContent('AL');
    expect(screen.getByRole('img', { name: 'Grace Brewster Hopper' })).toHaveTextContent('GBH');
  });

  it('keeps a stable colour per seed', () => {
    expect(avatarColorIndex('user-1')).toBe(avatarColorIndex('user-1'));
    expect(avatarColorIndex('user-1')).toBeGreaterThanOrEqual(0);
    expect(avatarColorIndex('user-1')).toBeLessThan(8);
  });
});

describe('CountTabs', () => {
  it('shows counts and moves with the arrow keys', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CountTabs
        label="Client lists"
        value="clients"
        onChange={onChange}
        items={[
          { value: 'clients', label: 'Clients', count: 12 },
          { value: 'archived', label: 'Archived' },
        ]}
      />,
    );
    const selected = screen.getByRole('tab', { selected: true });
    expect(selected).toHaveTextContent('Clients12');
    selected.focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('archived');
  });

  describe('when the strip overflows', () => {
    const items = [
      { value: 'all', label: 'All' },
      { value: 'draft', label: 'Draft' },
      { value: 'overdue', label: 'Overdue' },
    ];
    const scrollBy = vi.fn();
    const originalScrollBy = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollBy');

    /** jsdom has no layout: give the strip a 200 px box over 600 px of tabs. */
    const stubLayout = () => {
      vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(600);
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(200);
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(80);
      vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (
        this: HTMLElement,
      ) {
        return this.dataset.tab === 'overdue' ? 500 : 0;
      });
      Object.defineProperty(HTMLElement.prototype, 'scrollBy', {
        configurable: true,
        value: scrollBy,
      });
    };

    afterEach(() => {
      vi.restoreAllMocks();
      scrollBy.mockReset();
      if (originalScrollBy)
        Object.defineProperty(HTMLElement.prototype, 'scrollBy', originalScrollBy);
      else Reflect.deleteProperty(HTMLElement.prototype, 'scrollBy');
    });

    it('renders no scroll buttons when every tab fits', () => {
      const { container } = render(<CountTabs label="Statuses" value="all" items={items} />);
      expect(container.querySelectorAll('button')).toHaveLength(items.length);
    });

    it('shows an end arrow that pages the strip', async () => {
      stubLayout();
      const user = userEvent.setup();
      const { container } = render(<CountTabs label="Statuses" value="all" items={items} />);

      const arrows = container.querySelectorAll('button[aria-hidden="true"]');
      expect(arrows).toHaveLength(1);
      expect(arrows[0]).toHaveAttribute('tabindex', '-1');
      // The tablist still holds only the tabs.
      expect(
        screen.getByRole('tablist', { name: 'Statuses' }).querySelectorAll('button'),
      ).toHaveLength(items.length);
      await user.click(arrows[0] as HTMLElement);
      expect(scrollBy).toHaveBeenCalledWith({ left: 160, behavior: 'smooth' });
    });

    it('scrolls the selected tab into view', () => {
      stubLayout();
      render(<CountTabs label="Statuses" value="overdue" items={items} />);
      const list = screen.getByRole('tablist', { name: 'Statuses' });

      // The tab (500…580 px) lies inside the visible 200 px of the strip.
      expect(list.scrollLeft).toBeLessThanOrEqual(500);
      expect(list.scrollLeft + 200).toBeGreaterThanOrEqual(580);
    });
  });
});

describe('DataTable', () => {
  it('sorts on the client with empty values last', () => {
    expect(
      sortRows(rows, columns, { columnId: 'name', direction: 'asc' }).map((row) => row.id),
    ).toEqual(['b', 'a', 'c']);
    expect(
      sortRows(rows, columns, { columnId: 'fee', direction: 'desc' }).map((row) => row.id),
    ).toEqual(['a', 'c', 'b']);
    expect(sortRows(rows, columns, null).map((row) => row.id)).toEqual(['a', 'b', 'c']);
  });

  it('selects rows, all at once, and reports sort clicks', async () => {
    const onSelectedChange = vi.fn();
    const onSortChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DataTable
        caption="Clients"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        selectable
        selected={new Set(['a'])}
        onSelectedChange={onSelectedChange}
        selectLabel={(row) => `Select ${row.name}`}
        sort={{ columnId: 'name', direction: 'asc' }}
        onSortChange={onSortChange}
      />,
    );
    const all = screen.getByRole('checkbox', { name: 'Select all rows' });
    expect((all as HTMLInputElement).indeterminate).toBe(true);
    await user.click(all);
    expect(onSelectedChange).toHaveBeenLastCalledWith(new Set(['a', 'b', 'c']));
    await user.click(screen.getByRole('checkbox', { name: 'Select Gamma LLP' }));
    expect(onSelectedChange).toHaveBeenLastCalledWith(new Set(['a', 'c']));

    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await user.click(screen.getByRole('button', { name: 'Name' }));
    expect(onSortChange).toHaveBeenCalledWith({ columnId: 'name', direction: 'desc' });
    await user.click(screen.getByRole('button', { name: 'Fee' }));
    expect(onSortChange).toHaveBeenCalledWith({ columnId: 'fee', direction: 'asc' });
  });

  it('hides columns and shows the empty state', () => {
    render(
      <DataTable
        caption="Clients"
        columns={columns}
        rows={[]}
        rowKey={(row) => row.id}
        hiddenColumns={new Set(['fee'])}
        empty={<p>No clients yet</p>}
      />,
    );
    expect(screen.getByText('No clients yet')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Fee' })).not.toBeInTheDocument();
  });

  it('can keep its header in view from lg up: the cells stick under an offset and the card clips instead of hiding', () => {
    const table = (stickyHeader: boolean) => (
      <DataTable
        caption="Clients"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        stickyHeader={stickyHeader}
      />
    );
    const { container, rerender } = render(table(false));
    const header = () => screen.getAllByRole('columnheader')[0] as HTMLElement;
    expect(header().className).not.toContain('sticky');
    expect(container.querySelector('.overflow-hidden')).not.toBeNull();

    rerender(table(true));
    // Only from lg: below it the table scrolls sideways inside the card, where a sticky offset
    // would push the header over the first rows.
    expect(header()).toHaveClass('lg:sticky', 'lg:z-10');
    expect(header()).not.toHaveClass('sticky');
    expect(header().className).toContain('lg:top-[var(--table-sticky-top,0px)]');
    // `overflow: hidden` would turn the card into the scroll container the header sticks to.
    expect(container.querySelector('.overflow-hidden')).toBeNull();
    expect(container.querySelector('.overflow-clip')).not.toBeNull();
  });
});
