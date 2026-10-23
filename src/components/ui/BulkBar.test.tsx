import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BulkBar, type BulkBarProps } from './BulkBar';
import { ConfirmDialog } from './ConfirmDialog';

const EDITS = [
  { value: 'status', label: 'Set status' },
  { value: 'manager', label: 'Set manager' },
];

function setup(props: Partial<BulkBarProps> = {}) {
  const handlers = { onClear: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() };
  render(<BulkBar count={3} noun="jobs" editOptions={EDITS} {...handlers} {...props} />);
  return handlers;
}

describe('BulkBar', () => {
  it('says how many are selected and clears the selection', async () => {
    const user = userEvent.setup();
    const { onClear } = setup();
    const bar = screen.getByRole('region', { name: 'Bulk actions for jobs' });
    expect(within(bar).getByText('3 selected')).toBeInTheDocument();
    await user.click(within(bar).getByRole('button', { name: 'Clear' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('offers the edits in a menu and reports the one chosen', async () => {
    const user = userEvent.setup();
    const { onEdit } = setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('option', { name: 'Set manager' }));
    expect(onEdit).toHaveBeenCalledWith('manager');
  });

  it('has a danger Delete that calls onDelete', async () => {
    const user = userEvent.setup();
    const { onDelete } = setup();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('draws only what the page offers', () => {
    setup({ editOptions: undefined, onDelete: undefined });
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeEnabled();
  });

  it('waits while a call runs', () => {
    setup({ busy: true });
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
  });

  it('refuses a selection above the limit and says so', () => {
    setup({ count: 201, limit: 200 });
    expect(
      screen.getByText('Select at most 200 jobs to act on them together.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  it('reads the result out politely', () => {
    setup({ announcement: '3 jobs deleted' });
    expect(screen.getByRole('status')).toHaveTextContent('3 jobs deleted');
  });
});

describe('ConfirmDialog refusals with items', () => {
  it('lists the rows a refusal is about', () => {
    render(
      <ConfirmDialog
        open
        onClose={() => undefined}
        onConfirm={() => undefined}
        title="Delete 2 jobs?"
        confirmLabel="Delete"
        error={{
          message: '1 job has time. Nothing was deleted.',
          items: [{ label: 'J00001', reason: 'Has time.' }],
        }}
      >
        <p>Body</p>
      </ConfirmDialog>,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Nothing was deleted.');
    expect(within(alert).getByRole('listitem')).toHaveTextContent('J00001: Has time.');
  });
});
