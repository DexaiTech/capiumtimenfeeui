import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { expectRequiredFields, isMarkedRequired } from '@/test/requiredFields';
import { server } from '@/test/server';

import { adjustment, item, transfer } from '../test/fixtures';
import { createBackend, wipHandlers } from '../test/handlers';
import { WIP, renderWipPage } from '../test/render';
import WipAdjustmentsPage from './WipAdjustmentsPage';
import WipDetailsPage from './WipDetailsPage';
import WipTransfersPage from './WipTransfersPage';

describe('mandatory fields of the WIP dialogs', () => {
  it('marks the client, the amount and the reason of an adjustment', async () => {
    const user = userEvent.setup();
    server.use(...wipHandlers(createBackend({ adjustments: [adjustment()] })));
    renderWipPage(<WipAdjustmentsPage />, {
      route: `${WIP}/adjustments`,
      path: `${WIP}/adjustments`,
    });
    await user.click(await screen.findByRole('button', { name: 'Adjust WIP' }));
    const dialog = await screen.findByRole('region', { name: 'Adjust WIP' });
    expectRequiredFields(dialog, {
      required: ['Amount (£)', 'Reason'],
      optional: ['Kind of WIP', 'Effective date'],
    });
    expect(isMarkedRequired(within(dialog).getByRole('combobox', { name: 'Client' }))).toBe(true);
    // The job is optional: empty adjusts the client's WIP as a whole.
    expect(isMarkedRequired(within(dialog).getByRole('combobox', { name: 'Job' }))).toBe(false);
  });

  it('marks the reason of a rejection but not the note of an approval', async () => {
    const user = userEvent.setup();
    server.use(...wipHandlers(createBackend({ adjustments: [adjustment()] })));
    renderWipPage(<WipAdjustmentsPage />, {
      route: `${WIP}/adjustments`,
      path: `${WIP}/adjustments`,
    });
    const open = async (action: string) => {
      await screen.findByText('Client disputed the hours');
      const row = screen
        .getAllByRole('row')
        .find((entry) => entry.textContent?.includes('Client disputed the hours'));
      if (!row) throw new Error('no row');
      await user.click(within(row).getByRole('button', { name: /^Actions for/ }));
      await user.click(await screen.findByRole('menuitem', { name: action }));
    };
    await open('Reject');
    let dialog = await screen.findByRole('dialog', { name: 'Reject this adjustment?' });
    expectRequiredFields(dialog, { required: ['Reason'] });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await open('Approve');
    dialog = await screen.findByRole('dialog', { name: 'Approve this adjustment?' });
    expectRequiredFields(dialog, { required: [], optional: ['Note'] });
  });

  it('marks the reason of a write-off, not its date', async () => {
    const user = userEvent.setup();
    server.use(
      ...wipHandlers(
        createBackend({
          items: [item({ id: 't-1', description: 'Bank reconciliation', value: 18000 })],
        }),
      ),
    );
    renderWipPage(<WipDetailsPage />, { route: `${WIP}/details`, path: `${WIP}/details` });
    await user.click(await screen.findByRole('checkbox', { name: 'Select Bank reconciliation' }));
    await user.click(screen.getByRole('button', { name: 'Write off' }));
    const dialog = await screen.findByRole('dialog', { name: 'Write off WIP' });
    expectRequiredFields(dialog, { required: ['Reason'], optional: ['Written off on'] });
  });

  it('marks the client, both jobs and the reason of a transfer, and what it moves', async () => {
    const user = userEvent.setup();
    server.use(...wipHandlers(createBackend({ transfers: [transfer()] })));
    renderWipPage(<WipTransfersPage />, { route: `${WIP}/transfers`, path: `${WIP}/transfers` });
    await user.click(await screen.findByRole('button', { name: 'Transfer WIP' }));
    const dialog = await screen.findByRole('dialog', { name: 'Transfer WIP' });
    expectRequiredFields(dialog, {
      required: ['Amount (£)', 'Reason'],
      optional: ['Kind of WIP', 'Effective date'],
    });
    for (const name of ['Client', 'From job', 'To job']) {
      expect(isMarkedRequired(within(dialog).getByRole('combobox', { name }))).toBe(true);
    }
    await user.click(within(dialog).getByRole('button', { name: 'Specific items' }));
    expect(within(dialog).getByText('Items to move')).toHaveClass('field-required');
    expect(within(dialog).getByRole('group', { name: 'Items to move' })).toHaveAttribute(
      'aria-required',
      'true',
    );
    expect(within(dialog).queryByLabelText('Amount (£)')).toBeNull();
  });
});
