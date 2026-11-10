import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DataTable, type DataTableColumn } from './DataTable';

interface Row {
  id: string;
  name: string;
}

const rows: Row[] = [{ id: '1', name: 'Alpha' }];

const columns: DataTableColumn<Row>[] = [
  { id: 'name', header: 'Name', cell: (row) => <span>{row.name}</span> },
  {
    id: 'actions',
    header: 'Actions',
    cell: (row) => <button type="button">Actions for {row.name}</button>,
  },
];

describe('DataTable: actions heading', () => {
  it('keeps a hidden "Actions" heading unless a visible one is given', () => {
    const { rerender } = render(
      <DataTable
        caption="Rows"
        columns={columns.slice(0, 1)}
        rows={rows}
        rowKey={(r) => r.id}
        rowActions={() => <button type="button">Edit</button>}
      />,
    );
    const hidden = screen.getByRole('columnheader', { name: 'Actions' });
    expect(hidden.firstElementChild).toHaveClass('sr-only');

    rerender(
      <DataTable
        caption="Rows"
        columns={columns.slice(0, 1)}
        rows={rows}
        rowKey={(r) => r.id}
        rowActions={() => <button type="button">Edit</button>}
        actionsHeader="Action"
      />,
    );
    const shown = screen.getByRole('columnheader', { name: 'Action' });
    expect(shown).toHaveTextContent(/^Action$/);
    expect(shown).toHaveClass('text-right');
    expect(shown.firstElementChild).toBeNull();
  });
});

describe('DataTable: row click', () => {
  it('opens the row from plain text in it', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable
        caption="Rows"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
      />,
    );
    await user.click(screen.getByText('Alpha'));
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it('leaves a click on a control inside the row to that control', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable
        caption="Rows"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Actions for Alpha' }));
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
