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
