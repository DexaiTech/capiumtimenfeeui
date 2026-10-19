import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { server } from '@/test/server';

import { IDS, item, person, transfer } from '../test/fixtures';
import { callsOf, createBackend, wipHandlers, type WipBackend } from '../test/handlers';
import { WIP, renderWipPage } from '../test/render';
import WipTransfersPage from './WipTransfersPage';

const TRANSFERS = `${WIP}/transfers`;
const READ_ONLY = ['organization.read', 'member.read', 'client.read', 'job.read', 'wip.read'];

const transfers = () => [
  transfer(),
  transfer({
    id: 'tr-2',
    amount: 5000,
    items: [],
    reason: 'Moved by amount',
    status: 'reversed',
    reversed_by: person(IDS.ben, 'Ben Carter'),
    reversed_at: '2026-10-14T09:00:00Z',
    reversal_reason: 'Wrong job again',
  }),
];

const wip = () => [
  item({ id: 't-1', description: 'Bank reconciliation', value: 18000 }),
  item({ id: 't-2', description: 'VAT return', value: 30000 }),
  item({
    kind: 'disbursement',
    id: 'd-1',
    description: 'Companies House fee',
    component: 'expense',
    value: 1300,
    minutes: null,
    hours: null,
    rate: null,
  }),
];

function setup(
  init: Partial<WipBackend> = {},
  options: { permissions?: string[]; route?: string } = {},
) {
  const backend = createBackend({ transfers: transfers(), items: wip(), ...init });
  server.use(...wipHandlers(backend));
  renderWipPage(<WipTransfersPage />, {
    permissions: options.permissions ?? OWNER_PERMISSIONS,
    route: options.route ?? TRANSFERS,
    path: TRANSFERS,
  });
  return backend;
}

const lists = (backend: WipBackend) =>
  callsOf(backend, 'GET').filter((call) => call.path === '/wip/transfers');

const table = async () => {
  const element = await screen.findByRole('table', { name: 'WIP transfers' });
  await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));
  return element;
};

const rowsOf = (element: HTMLElement) => within(element).getAllByRole('row').slice(1);

async function openActions(user: ReturnType<typeof userEvent.setup>, text: string) {
  const row = rowsOf(await table()).find((entry) => entry.textContent?.includes(text));
  if (!row) throw new Error(`no row with ${text}`);
  await user.click(within(row).getByRole('button', { name: /^Actions for/ }));
}

/** The dialog of a new transfer with the client and the two jobs chosen. */
async function startTransfer(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Transfer WIP' }));
  const dialog = await screen.findByRole('dialog', { name: 'Transfer WIP' });
  await user.click(within(dialog).getByRole('combobox', { name: 'Client' }));
  await user.click(await screen.findByRole('option', { name: /Acme Ltd/ }));
  await user.click(within(dialog).getByRole('combobox', { name: 'From job' }));
  await user.click(await screen.findByRole('option', { name: /J00001/ }));
  await user.click(within(dialog).getByRole('combobox', { name: 'To job' }));
  await user.click(await screen.findByRole('option', { name: /J00002/ }));
  return dialog;
}

describe('the transfers', () => {
  it('lists them with their client, jobs, amount, items, reason and status', async () => {
    const backend = setup();
    const rows = rowsOf(await table());

    expect(lists(backend)[0]?.params?.get('status')).toBeNull();
    expect(rows).toHaveLength(2);
    const [applied, reversed] = rows as [HTMLElement, HTMLElement];
    expect(applied).toHaveTextContent('Acme Ltd');
    expect(applied).toHaveTextContent('J00001 Year-end accounts');
    expect(applied).toHaveTextContent('J00002 Bookkeeping');
    expect(applied).toHaveTextContent('£360.00');
    expect(applied).toHaveTextContent('2 items');
    expect(applied).toHaveTextContent('Booked to the wrong job');
    expect(applied).toHaveTextContent('Applied');
    expect(reversed).toHaveTextContent('An amount');
    expect(reversed).toHaveTextContent('Reversed');
    expect(screen.getByText('Showing 2 transfers · End of the list')).toBeInTheDocument();
  });

  it('narrows by status, through the API', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('tab', { name: 'Reversed' }));
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('status')).toBe('reversed'));
    await waitFor(() => expect(rowsOf(screen.getByRole('table'))).toHaveLength(1));
    expect(screen.getByRole('table')).toHaveTextContent('Moved by amount');
  });

  it('says so when there are none, and when nothing matches', async () => {
    const user = userEvent.setup();
    setup({ transfers: [] });
    expect(await screen.findByText('No transfers yet')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Applied' }));
    expect(await screen.findByText('No transfers match')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('No transfers yet')).toBeInTheDocument();
  });

  it('shows the items of a transfer and who reversed it', async () => {
    const user = userEvent.setup();
    setup();
    await openActions(user, 'Moved by amount');
    await user.click(await screen.findByRole('menuitem', { name: 'Details' }));

    const dialog = await screen.findByRole('dialog', { name: 'WIP transfer' });
    expect(dialog).toHaveTextContent('Moved by amount, not by item.');
    expect(dialog).toHaveTextContent('Ben Carter');
    expect(dialog).toHaveTextContent('Wrong job again');
  });
});

describe('reversing a transfer', () => {
  it('reverses one with a reason', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await openActions(user, 'Booked to the wrong job');
    await user.click(await screen.findByRole('menuitem', { name: 'Reverse' }));

    const dialog = await screen.findByRole('dialog', { name: 'Reverse this transfer?' });
    expect(dialog).toHaveTextContent(
      '£360.00 goes back from J00002 Bookkeeping to J00001 Year-end accounts.',
    );
    expect(within(dialog).getByRole('button', { name: 'Reverse transfer' })).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Reason'), 'It was right after all');
    await user.click(within(dialog).getByRole('button', { name: 'Reverse transfer' }));

    expect(await screen.findByText('Transfer reversed')).toBeInTheDocument();
    expect(callsOf(backend, 'POST')[0]).toMatchObject({
      path: '/wip/transfers/tr-1/reverse',
      body: { reason: 'It was right after all' },
    });
    expect(backend.transfers[0]?.status).toBe('reversed');
  });

  it('keeps the dialog open with the reason when the API refuses', async () => {
    const user = userEvent.setup();
    setup({
      refusals: {
        'POST /wip/transfers/reverse': {
          status: 409,
          code: 'TRANSFER_SETTLED',
          message: 'One of the jobs has been billed since.',
        },
      },
    });
    await openActions(user, 'Booked to the wrong job');
    await user.click(await screen.findByRole('menuitem', { name: 'Reverse' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reverse this transfer?' });
    await user.type(within(dialog).getByLabelText('Reason'), 'Mistake');
    await user.click(within(dialog).getByRole('button', { name: 'Reverse transfer' }));

    expect(
      await within(dialog).findByText('One of the jobs has been billed since.'),
    ).toBeInTheDocument();
  });
});

describe('transferring WIP', () => {
  it('moves an amount from one job to another', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    const dialog = await startTransfer(user);
    await user.type(within(dialog).getByLabelText('Amount (£)'), '360');
    await user.type(within(dialog).getByLabelText('Reason'), 'Booked to the wrong job');
    await user.click(within(dialog).getByRole('button', { name: 'Transfer WIP' }));

    expect(await screen.findByText('WIP transferred')).toBeInTheDocument();
    expect(callsOf(backend, 'POST')[0]).toMatchObject({
      path: '/wip/transfers',
      body: {
        from_job_id: 'j-1',
        to_job_id: 'j-2',
        amount: 36000,
        reason: 'Booked to the wrong job',
      },
    });
    expect(callsOf(backend, 'POST')[0]?.body).not.toHaveProperty('items');
  });

  it('moves the items chosen from the WIP of the job it leaves', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    const dialog = await startTransfer(user);
    await user.click(within(dialog).getByRole('button', { name: 'Specific items' }));
    await user.click(await within(dialog).findByRole('checkbox', { name: /Bank reconciliation/ }));
    await user.click(within(dialog).getByRole('checkbox', { name: /VAT return/ }));
    await user.type(within(dialog).getByLabelText('Reason'), 'Wrong job');
    await user.click(within(dialog).getByRole('button', { name: 'Transfer WIP' }));

    expect(await screen.findByText('WIP transferred')).toBeInTheDocument();
    expect(callsOf(backend, 'POST')[0]?.body).toMatchObject({
      from_job_id: 'j-1',
      to_job_id: 'j-2',
      items: [
        { kind: 'time', id: 't-1' },
        { kind: 'time', id: 't-2' },
      ],
    });
    expect(callsOf(backend, 'POST')[0]?.body).not.toHaveProperty('amount');
  });

  it('refuses items of two kinds of WIP, and a job that is the same on both sides', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    const dialog = await startTransfer(user);
    await user.click(within(dialog).getByRole('button', { name: 'Specific items' }));
    await user.click(await within(dialog).findByRole('checkbox', { name: /Bank reconciliation/ }));
    await user.click(within(dialog).getByRole('checkbox', { name: /Companies House fee/ }));
    await user.type(within(dialog).getByLabelText('Reason'), 'Wrong job');
    await user.click(within(dialog).getByRole('button', { name: 'Transfer WIP' }));
    expect(
      await within(dialog).findByText('Select one kind of WIP to transfer: time, or expenses.'),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('combobox', { name: 'To job' }));
    await user.click(await screen.findByRole('option', { name: /J00001/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Transfer WIP' }));
    expect(
      await within(dialog).findByText('Choose a different job from the one the WIP leaves'),
    ).toBeInTheDocument();
    expect(callsOf(backend, 'POST')).toHaveLength(0);
  });

  it('asks for what is missing before sending anything', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: 'Transfer WIP' }));
    const dialog = await screen.findByRole('dialog', { name: 'Transfer WIP' });
    await user.click(within(dialog).getByRole('button', { name: 'Transfer WIP' }));

    expect(await within(dialog).findByText('Choose the client')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose the job the WIP leaves')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose the job the WIP goes to')).toBeInTheDocument();
    expect(within(dialog).getByText('Say why the WIP is moved')).toBeInTheDocument();
    expect(callsOf(backend, 'POST')).toHaveLength(0);
  });

  it('shows what the API refuses in the dialog', async () => {
    const user = userEvent.setup();
    setup({
      refusals: {
        'POST /wip/transfers': {
          status: 409,
          code: 'JOB_NOT_OPEN',
          message: 'The job the WIP goes to is closed.',
        },
      },
    });
    await table();

    const dialog = await startTransfer(user);
    await user.type(within(dialog).getByLabelText('Amount (£)'), '10');
    await user.type(within(dialog).getByLabelText('Reason'), 'Wrong job');
    await user.click(within(dialog).getByRole('button', { name: 'Transfer WIP' }));

    expect(
      await within(dialog).findByText('The job the WIP goes to is closed.'),
    ).toBeInTheDocument();
  });
});

describe('the permissions', () => {
  it('shows a reader the transfers without a way to make or reverse any', async () => {
    const user = userEvent.setup();
    setup({}, { permissions: READ_ONLY });
    await table();
    expect(screen.queryByRole('button', { name: 'Transfer WIP' })).not.toBeInTheDocument();

    await openActions(user, 'Booked to the wrong job');
    expect(await screen.findByRole('menuitem', { name: 'Details' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Reverse' })).not.toBeInTheDocument();
  });
});
