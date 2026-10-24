import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { server } from '@/test/server';

import { IDS, adjustment, globex, movement, person, writeOff } from '../test/fixtures';
import { callsOf, createBackend, wipHandlers, type WipBackend } from '../test/handlers';
import { WIP, renderWipPage } from '../test/render';
import WipAdjustmentsPage from './WipAdjustmentsPage';

const ADJUSTMENTS = `${WIP}/adjustments`;
const READ_ONLY = ['organization.read', 'member.read', 'client.read', 'job.read', 'wip.read'];

const adjustments = () => [
  adjustment(),
  adjustment({
    id: 'a-2',
    kind: 'write_on',
    status: 'approved',
    amount: 10000,
    signed_amount: 10000,
    approval_required: false,
    in_force: true,
    reason: 'Fee agreed with the client',
    effective_date: '2026-10-05',
    requested_by: person(IDS.ada, 'Ada Lovelace'),
    decided_by: person(IDS.ada, 'Ada Lovelace'),
    decided_at: '2026-10-05T09:00:00Z',
  }),
  adjustment({
    id: 'a-3',
    status: 'rejected',
    amount: 80000,
    signed_amount: -80000,
    reason: 'Too much',
    decided_by: person(IDS.cara, 'Cara Diaz'),
    decided_at: '2026-10-08T09:00:00Z',
    decision_note: 'Not agreed',
  }),
];

function setup(
  init: Partial<WipBackend> = {},
  options: { permissions?: string[]; route?: string } = {},
) {
  const backend = createBackend({ adjustments: adjustments(), ...init });
  server.use(...wipHandlers(backend));
  renderWipPage(<WipAdjustmentsPage />, {
    permissions: options.permissions ?? OWNER_PERMISSIONS,
    route: options.route ?? ADJUSTMENTS,
    path: ADJUSTMENTS,
  });
  return backend;
}

const lists = (backend: WipBackend) =>
  callsOf(backend, 'GET').filter((call) => call.path === '/wip/adjustments');

const table = async () => {
  const element = await screen.findByRole('table', { name: 'WIP adjustments' });
  await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));
  return element;
};

const rowsOf = (element: HTMLElement) => within(element).getAllByRole('row').slice(1);

/** Opens the actions menu of the row that holds this text and returns its table. */
async function openActions(user: ReturnType<typeof userEvent.setup>, text: string) {
  const row = rowsOf(await table()).find((entry) => entry.textContent?.includes(text));
  if (!row) throw new Error(`no row with ${text}`);
  await user.click(within(row).getByRole('button', { name: /^Actions for/ }));
}

describe('the adjustments', () => {
  it('lists them with their kind, amount, status and what the status means', async () => {
    const backend = setup();
    const rows = rowsOf(await table());

    expect(lists(backend)[0]?.params?.getAll('status')).toEqual([]);
    expect(rows).toHaveLength(3);
    const [pending, approved, rejected] = rows as [HTMLElement, HTMLElement, HTMLElement];
    expect(pending).toHaveTextContent('Acme Ltd');
    expect(pending).toHaveTextContent('J00001 Year-end accounts');
    expect(pending).toHaveTextContent('Write-off');
    expect(pending).toHaveTextContent('-£2,500.00');
    expect(pending).toHaveTextContent('Pending approval');
    expect(pending).toHaveTextContent('Above the £500.00 limit');
    expect(pending).toHaveTextContent('Client disputed the hours');
    expect(approved).toHaveTextContent('Write-on');
    expect(approved).toHaveTextContent('+£100.00');
    expect(approved).toHaveTextContent('In force');
    expect(rejected).toHaveTextContent('Rejected');
    expect(rejected).toHaveTextContent('Cara Diaz');
    expect(rejected).toHaveTextContent('Not agreed');
    expect(screen.getByText('Showing 3 adjustments · End of the list')).toBeInTheDocument();
  });

  it('counts the adjustments of each status on its tab and narrows by it', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    expect(await screen.findByRole('tab', { name: /Pending approval/ })).toHaveTextContent('1');
    expect(screen.getByRole('tab', { name: /^All/ })).toHaveTextContent('3');
    await user.click(screen.getByRole('tab', { name: /Approved/ }));
    await waitFor(() =>
      expect(lists(backend).at(-1)?.params?.getAll('status')).toEqual(['approved']),
    );
    await waitFor(() => expect(rowsOf(screen.getByRole('table'))).toHaveLength(1));
    expect(screen.getByRole('table')).toHaveTextContent('Fee agreed with the client');
  });

  it('tells an approver what waits for approval, and takes them to it', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    const note = await screen.findByRole('note');
    expect(note).toHaveTextContent('1 adjustment is waiting for approval, £2,500.00 in all.');
    await user.click(within(note).getByRole('button', { name: 'Review' }));
    await waitFor(() =>
      expect(lists(backend).at(-1)?.params?.getAll('status')).toEqual(['pending']),
    );
    await waitFor(() => expect(screen.queryByRole('note')).not.toBeInTheDocument());
  });

  it('filters by kind and says when nothing matches', async () => {
    const user = userEvent.setup();
    const backend = setup({ adjustments: [] });
    expect(await screen.findByText('No adjustments yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Filter/ }));
    const panel = await screen.findByRole('dialog', { name: 'Filter adjustments' });
    await user.selectOptions(within(panel).getByLabelText('Adjustment'), 'Write-on');
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('kind')).toBe('write_on'));
    expect(await screen.findByText('No adjustments match')).toBeInTheDocument();
  });
});

describe('deciding on an adjustment', () => {
  it('approves one, with an optional note', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await openActions(user, 'Client disputed the hours');
    await user.click(await screen.findByRole('menuitem', { name: 'Approve' }));

    const dialog = await screen.findByRole('dialog', { name: 'Approve this adjustment?' });
    expect(dialog).toHaveTextContent('Write-off of £2,500.00 on J00001 Year-end accounts.');
    await user.type(within(dialog).getByLabelText('Note'), 'Agreed by phone');
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('Adjustment approved')).toBeInTheDocument();
    expect(callsOf(backend, 'POST')[0]).toMatchObject({
      path: '/wip/adjustments/a-1/approve',
      body: { note: 'Agreed by phone' },
    });
    await waitFor(() => expect(screen.queryByRole('note')).not.toBeInTheDocument());
  });

  it('will not reject without a reason, and sends the reason when there is one', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await openActions(user, 'Client disputed the hours');
    await user.click(await screen.findByRole('menuitem', { name: 'Reject' }));

    const dialog = await screen.findByRole('dialog', { name: 'Reject this adjustment?' });
    expect(within(dialog).getByRole('button', { name: 'Reject' })).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Reason'), 'Not justified');
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }));

    expect(await screen.findByText('Adjustment rejected')).toBeInTheDocument();
    expect(callsOf(backend, 'POST')[0]).toMatchObject({
      path: '/wip/adjustments/a-1/reject',
      body: { reason: 'Not justified' },
    });
  });

  it('reverses an approved adjustment that still counts', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await openActions(user, 'Fee agreed with the client');
    await user.click(await screen.findByRole('menuitem', { name: 'Reverse' }));

    const dialog = await screen.findByRole('dialog', { name: 'Reverse this adjustment?' });
    await user.type(within(dialog).getByLabelText('Reason'), 'Entered twice');
    await user.click(within(dialog).getByRole('button', { name: 'Reverse' }));

    expect(await screen.findByText('Adjustment reversed')).toBeInTheDocument();
    expect(callsOf(backend, 'POST')[0]).toMatchObject({
      path: '/wip/adjustments/a-2/reverse',
      body: { reason: 'Entered twice' },
    });
    expect(backend.adjustments.find((entry) => entry.id === 'a-2')?.status).toBe('reversed');
  });

  it('keeps the dialog open with the reason when the API refuses', async () => {
    const user = userEvent.setup();
    setup({
      adjustments: [adjustment({ requested_by: person(IDS.ada, 'Ada Lovelace') })],
      selfApprovalForbidden: true,
    });
    await openActions(user, 'Client disputed the hours');
    await user.click(await screen.findByRole('menuitem', { name: 'Approve' }));
    const dialog = await screen.findByRole('dialog', { name: 'Approve this adjustment?' });
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));

    expect(
      await within(dialog).findByText('You cannot approve your own request.'),
    ).toBeInTheDocument();
  });

  it('shows the trail of an adjustment', async () => {
    const user = userEvent.setup();
    setup();
    await openActions(user, 'Not agreed');
    await user.click(await screen.findByRole('menuitem', { name: 'Details' }));

    const dialog = await screen.findByRole('dialog', { name: 'WIP adjustment' });
    expect(dialog).toHaveTextContent('Requested');
    expect(dialog).toHaveTextContent('Ben Carter');
    expect(dialog).toHaveTextContent('Decided');
    expect(dialog).toHaveTextContent('Cara Diaz');
    expect(dialog).toHaveTextContent('Not agreed');
  });
});

describe('writing WIP on or off', () => {
  it('sends the adjustment, and says when it needs approval', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: 'Adjust WIP' }));
    const dialog = await screen.findByRole('region', { name: 'Adjust WIP' });
    expect(dialog).toHaveTextContent('Above £500.00 needs approval');
    await user.click(within(dialog).getByRole('combobox', { name: 'Client' }));
    await user.click(await screen.findByRole('option', { name: /Acme Ltd/ }));
    await user.type(within(dialog).getByLabelText('Amount (£)'), '2,500.00');
    await user.type(within(dialog).getByLabelText('Reason'), 'Client disputed the hours');
    await user.click(within(dialog).getByRole('button', { name: 'Adjust WIP' }));

    expect(await screen.findByText('Sent for approval')).toBeInTheDocument();
    expect(callsOf(backend, 'POST')[0]).toMatchObject({
      path: '/wip/adjustments',
      body: {
        client_id: IDS.acme,
        kind: 'write_off',
        amount: 250000,
        reason: 'Client disputed the hours',
      },
    });
    expect(callsOf(backend, 'POST')[0]?.body).not.toHaveProperty('job_id');
  });

  it('adjusts at once when the amount is within the limit, for a job, as a write-on', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: 'Adjust WIP' }));
    const dialog = await screen.findByRole('region', { name: 'Adjust WIP' });
    await user.click(within(dialog).getByRole('combobox', { name: 'Client' }));
    await user.click(await screen.findByRole('option', { name: /Acme Ltd/ }));
    await user.click(within(dialog).getByRole('combobox', { name: 'Job' }));
    await user.click(await screen.findByRole('option', { name: /J00002/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Write on' }));
    await user.type(within(dialog).getByLabelText('Amount (£)'), '120');
    await user.selectOptions(within(dialog).getByLabelText('Kind of WIP'), 'Fixed fee');
    await user.type(within(dialog).getByLabelText('Reason'), 'Extra work agreed');
    await user.click(within(dialog).getByRole('button', { name: 'Adjust WIP' }));

    expect(await screen.findByText('WIP adjusted')).toBeInTheDocument();
    expect(callsOf(backend, 'POST')[0]?.body).toMatchObject({
      client_id: IDS.acme,
      job_id: 'j-2',
      kind: 'write_on',
      amount: 12000,
      component: 'fixed_fee',
      reason: 'Extra work agreed',
    });
  });

  it('asks for what is missing before sending anything', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: 'Adjust WIP' }));
    const dialog = await screen.findByRole('region', { name: 'Adjust WIP' });
    await user.click(within(dialog).getByRole('button', { name: 'Adjust WIP' }));

    expect(await within(dialog).findByText('Choose the client')).toBeInTheDocument();
    expect(within(dialog).getByText(/Enter an amount above zero in pounds/)).toBeInTheDocument();
    expect(within(dialog).getByText('Say why the WIP is adjusted')).toBeInTheDocument();
    expect(callsOf(backend, 'POST')).toHaveLength(0);
  });

  it('shows what the API refuses in the dialog', async () => {
    const user = userEvent.setup();
    setup({
      refusals: {
        'POST /wip/adjustments': {
          status: 409,
          code: 'INSUFFICIENT_WIP',
          message: 'The write-off is larger than the WIP there is.',
        },
      },
    });
    await table();

    await user.click(screen.getByRole('button', { name: 'Adjust WIP' }));
    const dialog = await screen.findByRole('region', { name: 'Adjust WIP' });
    await user.click(within(dialog).getByRole('combobox', { name: 'Client' }));
    await user.click(await screen.findByRole('option', { name: /Acme Ltd/ }));
    await user.type(within(dialog).getByLabelText('Amount (£)'), '10');
    await user.type(within(dialog).getByLabelText('Reason'), 'Goodwill');
    await user.click(within(dialog).getByRole('button', { name: 'Adjust WIP' }));

    expect(
      await within(dialog).findByText('The write-off is larger than the WIP there is.'),
    ).toBeInTheDocument();
  });
});

describe('the ledger', () => {
  const movements = () => [
    movement(),
    movement({
      id: 'm-2',
      kind: 'transfer_out',
      amount: -36000,
      reason: 'Booked to the wrong job',
      source_type: 'transfer',
      source_id: 'tr-1',
    }),
    movement({
      id: 'm-4',
      kind: 'credit_return',
      scope: 'items',
      amount: 0,
      item_count: 3,
      reason: 'Credit note CN-1',
      source_type: 'credit_note',
      source_id: 'cn-1',
    }),
  ];

  it('lists every movement with its kind and signed amount, and narrows by where it came from', async () => {
    const user = userEvent.setup();
    const backend = setup({ movements: movements() }, { route: `${ADJUSTMENTS}?view=ledger` });
    const element = await screen.findByRole('table', { name: 'WIP ledger' });
    await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));

    const rows = rowsOf(element);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('-£500.00');
    expect(rows[1]).toHaveTextContent('Transfer out');
    expect(rows[1]).toHaveTextContent('-£360.00');
    expect(rows[2]).toHaveTextContent('Credit note: returned');
    expect(rows[2]).toHaveTextContent('3 items');

    await user.click(screen.getByRole('tab', { name: 'Transfers' }));
    await waitFor(() =>
      expect(
        callsOf(backend, 'GET')
          .filter((call) => call.path === '/wip/ledger')
          .at(-1)
          ?.params?.get('source_type'),
      ).toBe('transfer'),
    );
    await waitFor(() => expect(rowsOf(screen.getByRole('table')).length).toBe(1));
  });

  it('has no write-off tab: an item write-off is not a ledger movement', async () => {
    setup({ movements: movements() }, { route: `${ADJUSTMENTS}?view=ledger` });
    await screen.findByRole('table', { name: 'WIP ledger' });
    expect(screen.getByRole('tab', { name: 'Transfers' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Write-offs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Actions for/ })).not.toBeInTheDocument();
  });
});

describe('the write-offs', () => {
  const WRITE_OFFS = `${ADJUSTMENTS}?view=write-offs`;
  const writeOffs = () => [
    writeOff(),
    writeOff({
      id: 'wo-2',
      client: globex,
      job_id: 'j-3',
      written_off_on: '2026-10-02',
      reason: 'Audit fee waived',
      total_wip_value: 120000,
      item_count: 5,
      created_by: IDS.ben,
    }),
  ];

  const listed = (backend: WipBackend) =>
    callsOf(backend, 'GET').filter((call) => call.path === '/wip/write-offs');

  const writeOffsTable = async () => {
    const element = await screen.findByRole('table', { name: 'WIP write-offs' });
    await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));
    return element;
  };

  it('lists them newest first with what was written off, why and by whom', async () => {
    setup({ writeOffs: writeOffs().reverse() }, { route: WRITE_OFFS });
    const rows = rowsOf(await writeOffsTable());

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('09/10/2026');
    expect(rows[0]).toHaveTextContent('Acme Ltd');
    expect(rows[0]).toHaveTextContent('2 items');
    expect(rows[0]).toHaveTextContent('-£45.50');
    expect(rows[0]).toHaveTextContent('Client agreed to drop the courier cost');
    expect(rows[0]).toHaveTextContent('Ada Lovelace');
    expect(rows[1]).toHaveTextContent('Globex plc');
    expect(rows[1]).toHaveTextContent('5 items');
    expect(rows[1]).toHaveTextContent('All the WIP of a job');
    expect(rows[1]).toHaveTextContent('-£1,200.00');
    expect(rows[1]).toHaveTextContent('Ben Carter');
    expect(screen.getByText('Showing 2 write-offs · End of the list')).toBeInTheDocument();
  });

  it('narrows by client', async () => {
    const user = userEvent.setup();
    const backend = setup({ writeOffs: writeOffs() }, { route: WRITE_OFFS });
    await writeOffsTable();

    await user.click(screen.getByRole('button', { name: /Filter/ }));
    const panel = await screen.findByRole('dialog', { name: 'Filter the write-offs' });
    await user.click(within(panel).getByRole('combobox', { name: 'Client' }));
    await user.click(await screen.findByRole('option', { name: /Globex plc/ }));

    await waitFor(() => expect(listed(backend).at(-1)?.params?.get('client_id')).toBe(IDS.globex));
    await waitFor(() => expect(rowsOf(screen.getByRole('table'))).toHaveLength(1));
    expect(screen.getByRole('table')).toHaveTextContent('Audit fee waived');
  });

  it('reverses one after a confirmation, and it leaves the list', async () => {
    const user = userEvent.setup();
    const backend = setup({ writeOffs: writeOffs() }, { route: WRITE_OFFS });
    const row = rowsOf(await writeOffsTable()).find((entry) =>
      entry.textContent?.includes('courier'),
    );
    if (!row) throw new Error('no write-off row');
    await user.click(
      within(row).getByRole('button', { name: 'Actions for the write-off of £45.50' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Reverse the write-off' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reverse this write-off?' });
    await user.click(within(dialog).getByRole('button', { name: 'Reverse write-off' }));

    expect(await screen.findByText('Write-off reversed')).toBeInTheDocument();
    expect(callsOf(backend, 'DELETE')[0]?.path).toBe('/wip/write-offs/wo-1');
    await waitFor(() => expect(rowsOf(screen.getByRole('table'))).toHaveLength(1));
    expect(screen.getByRole('table')).not.toHaveTextContent('courier');
  });

  it('keeps the dialog open and says why when the items have been billed since', async () => {
    const user = userEvent.setup();
    setup(
      {
        writeOffs: writeOffs(),
        refusals: {
          'DELETE /wip/write-offs': {
            status: 409,
            code: 'WRITE_OFF_BILLED',
            message:
              'Some of these items have been billed since: the write-off cannot be reversed.',
          },
        },
      },
      { route: WRITE_OFFS },
    );
    const row = rowsOf(await writeOffsTable())[0];
    if (!row) throw new Error('no write-off row');
    await user.click(within(row).getByRole('button', { name: /^Actions for/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Reverse the write-off' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reverse this write-off?' });
    await user.click(within(dialog).getByRole('button', { name: 'Reverse write-off' }));

    expect(
      await within(dialog).findByText(
        'Some of these items have been billed since: the write-off cannot be reversed.',
      ),
    ).toBeInTheDocument();
    expect(rowsOf(screen.getByRole('table'))).toHaveLength(2);
  });

  it('says when there are none', async () => {
    setup({ writeOffs: [] }, { route: WRITE_OFFS });
    expect(await screen.findByText('No write-offs yet')).toBeInTheDocument();
  });

  it('shows a reader the list without a way to reverse any', async () => {
    setup({ writeOffs: writeOffs() }, { route: WRITE_OFFS, permissions: READ_ONLY });
    const rows = rowsOf(await writeOffsTable());
    expect(rows).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /^Actions for/ })).not.toBeInTheDocument();
    expect(rows[0]).toHaveTextContent('Ada Lovelace');
  });

  it('switches between the adjustments, the write-offs and the ledger', async () => {
    const user = userEvent.setup();
    setup({ writeOffs: writeOffs(), movements: [movement()] });
    await table();
    await user.click(screen.getByRole('button', { name: 'Write-offs' }));
    expect(await screen.findByRole('table', { name: 'WIP write-offs' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ledger' }));
    expect(await screen.findByRole('table', { name: 'WIP ledger' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Adjustments' }));
    expect(await screen.findByRole('table', { name: 'WIP adjustments' })).toBeInTheDocument();
  });
});

describe('the permissions', () => {
  it('shows a reader the adjustments without a way to make or decide any', async () => {
    setup({}, { permissions: READ_ONLY });
    await table();
    expect(screen.queryByRole('button', { name: 'Adjust WIP' })).not.toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    const rows = rowsOf(screen.getByRole('table'));
    expect(
      within(rows[0] as HTMLElement).getByRole('button', { name: /^Actions for/ }),
    ).toBeInTheDocument();
  });

  it('offers an approver the decision but not the reversal', async () => {
    const user = userEvent.setup();
    setup({}, { permissions: [...READ_ONLY, 'wip.approve'] });
    await openActions(user, 'Client disputed the hours');
    expect(await screen.findByRole('menuitem', { name: 'Approve' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await openActions(user, 'Fee agreed with the client');
    expect(await screen.findByRole('menuitem', { name: 'Details' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Reverse' })).not.toBeInTheDocument();
  });
});
