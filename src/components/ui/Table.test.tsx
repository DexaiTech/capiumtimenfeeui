import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Table, type TableColumn } from './Table';

interface Person {
  id: string;
  name: string;
  team: string;
}

const people: Person[] = [
  { id: '1', name: 'Ada Lovelace', team: 'Engines' },
  { id: '2', name: 'Grace Hopper', team: 'Compilers' },
];

const columns: TableColumn<Person>[] = [
  { id: 'name', header: 'Name', cell: (person) => person.name, sortable: true, card: 'title' },
  { id: 'team', header: 'Team', cell: (person) => person.team },
];

/** jsdom matches no media query (the card layout); this switches to the md-and-up layout. */
function desktop() {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string): MediaQueryList => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

describe('Table', () => {
  describe('from the md breakpoint', () => {
    it('renders a semantic table with a caption, headers, cells and row actions', () => {
      desktop();
      render(
        <Table
          caption="People"
          columns={columns}
          rows={people}
          rowKey={(person) => person.id}
          rowActions={(person) => <button type="button">Edit {person.name}</button>}
        />,
      );

      const table = screen.getByRole('table', { name: 'People' });
      expect(within(table).getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
      expect(within(table).getByRole('columnheader', { name: 'Team' })).toBeInTheDocument();
      expect(within(table).getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();
      // Header row plus one row per item.
      expect(within(table).getAllByRole('row')).toHaveLength(3);
      const row = within(table).getByRole('row', { name: /Grace Hopper/ });
      expect(within(row).getByRole('cell', { name: 'Compilers' })).toBeInTheDocument();
      expect(within(row).getByRole('button', { name: 'Edit Grace Hopper' })).toBeInTheDocument();
    });

    it('reports the sort with aria-sort and toggles it from the header button', async () => {
      desktop();
      const onSortChange = vi.fn();
      render(
        <Table
          caption="People"
          columns={columns}
          rows={people}
          rowKey={(person) => person.id}
          sort={{ columnId: 'name', direction: 'asc' }}
          onSortChange={onSortChange}
        />,
      );

      expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute(
        'aria-sort',
        'ascending',
      );
      // A column that cannot be sorted carries no aria-sort.
      expect(screen.getByRole('columnheader', { name: 'Team' })).not.toHaveAttribute('aria-sort');

      await userEvent.click(screen.getByRole('button', { name: 'Name' }));
      expect(onSortChange).toHaveBeenCalledWith({ columnId: 'name', direction: 'desc' });
    });

    it('expands a details row and reflects it in aria-expanded', async () => {
      desktop();
      render(
        <Table
          caption="People"
          columns={columns}
          rows={people}
          rowKey={(person) => person.id}
          expansion={{
            label: (person) => `Details of ${person.name}`,
            render: (person) => <p>More about {person.name}</p>,
          }}
        />,
      );

      const toggle = screen.getByRole('button', { name: 'Details of Ada Lovelace' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText('More about Ada Lovelace')).not.toBeInTheDocument();

      await userEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      const details = screen.getByText('More about Ada Lovelace');
      expect(details.closest('tr')).toHaveAttribute('id', toggle.getAttribute('aria-controls'));

      await userEvent.click(toggle);
      expect(screen.queryByText('More about Ada Lovelace')).not.toBeInTheDocument();
    });

    it('shows skeleton rows and announces loading', () => {
      desktop();
      render(
        <Table
          caption="People"
          columns={columns}
          rows={[]}
          rowKey={(person) => person.id}
          loading
          skeletonRows={4}
          empty={<p>Nobody here</p>}
        />,
      );

      expect(screen.getByRole('status', { name: 'Loading People' })).toBeInTheDocument();
      expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
      expect(screen.getAllByRole('row')).toHaveLength(5);
      expect(screen.queryByText('Nobody here')).not.toBeInTheDocument();
    });
  });

  describe('below the md breakpoint', () => {
    it('renders each row as a card with label/value pairs instead of a table', () => {
      render(
        <Table
          caption="People"
          columns={columns}
          rows={people}
          rowKey={(person) => person.id}
          rowActions={(person) => <button type="button">Edit {person.name}</button>}
        />,
      );

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      const list = screen.getByRole('list', { name: 'People' });
      const cards = within(list).getAllByRole('listitem');
      expect(cards).toHaveLength(2);
      const card = cards[1] as HTMLElement;
      // The title column has no label; the others are term/definition pairs.
      expect(within(card).getByText('Grace Hopper')).toBeInTheDocument();
      expect(within(card).queryByText('Name')).not.toBeInTheDocument();
      expect(within(card).getByRole('term')).toHaveTextContent('Team');
      expect(within(card).getByRole('definition')).toHaveTextContent('Compilers');
      expect(within(card).getByRole('button', { name: 'Edit Grace Hopper' })).toBeInTheDocument();
    });

    it('uses renderCard when given', () => {
      render(
        <Table
          caption="People"
          columns={columns}
          rows={people}
          rowKey={(person) => person.id}
          renderCard={(person) => <p>Card for {person.name}</p>}
        />,
      );
      expect(screen.getByText('Card for Ada Lovelace')).toBeInTheDocument();
      expect(screen.queryByRole('term')).not.toBeInTheDocument();
    });

    it('shows skeleton cards while loading', () => {
      render(
        <Table
          caption="People"
          columns={columns}
          rows={[]}
          rowKey={(person) => person.id}
          loading
        />,
      );
      expect(screen.getByRole('status', { name: 'Loading People' })).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'People' })).not.toBeInTheDocument();
    });
  });

  it('shows the empty slot when there are no rows', () => {
    render(
      <Table
        caption="People"
        columns={columns}
        rows={[]}
        rowKey={(person) => person.id}
        empty={<p>Nobody here</p>}
      />,
    );
    expect(screen.getByText('Nobody here')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'People' })).not.toBeInTheDocument();
  });
});
