import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { server } from '@/test/server';

import { IDS, globex, item } from '../test/fixtures';
import { callsOf, createBackend, wipHandlers, type WipBackend } from '../test/handlers';
import { WIP, renderWipPage } from '../test/render';
import WipDetailsPage from './WipDetailsPage';

const DETAILS = `${WIP}/details`;
const READ_ONLY = ['organization.read', 'member.read', 'client.read', 'job.read', 'wip.read'];

const items = () => [
  item({
    id: 't-1',
    date: '2026-09-07',
    description: 'Bank reconciliation',
    value: 18000,
    age_days: 41,
  }),
  item({
    id: 't-2',
    date: '2026-08-01',
    description: 'VAT return',
    minutes: 150,
    hours: '2.50',
    value: 30000,
    charge_value: 30000,
    age_days: 78,
  }),
  item({
    kind: 'disbursement',
    id: 'd-1',
    date: '2026-09-20',
    description: null,
    supplier: 'Companies House',
    person: null,
    minutes: null,
    hours: null,
    rate: null,
    value: 1300,
    charge_value: null,
    component: 'expense',
    age_days: 28,
  }),
  item({
    id: 't-3',
    date: '2026-10-01',
    job: { id: 'j-3', number: 'J00003', name: 'Audit', billing_basis: 'hourly' },
    client: globex,
    description: 'Audit planning',
    value: 45000,
    charge_value: 45000,
    age_days: 17,
  }),
  item({
    kind: 'fixed_fee',
    id: 'j-2',
    date: '2026-10-10',
    job: { id: 'j-2', number: 'J00002', name: 'Bookkeeping', billing_basis: 'fixed' },
    description: null,
    person: null,
    minutes: null,
    hours: null,
    rate: null,
    value: 120000,
    charge_value: null,
    component: 'fixed_fee',
    selectable: false,
    age_days: 8,
    fixed_fee: {
      fee: 240000,
      recognised: 120000,
      billed: 0,
      mode: 'by_budget_progress',
      progress_bp: 5000,
      time_entry_ids: [],
    },
  }),
];

function setup(
  init: Partial<WipBackend> = {},
  options: { permissions?: string[]; route?: string } = {},
) {
  const backend = createBackend({ items: items(), ...init });
  server.use(...wipHandlers(backend));
  renderWipPage(<WipDetailsPage />, {
    permissions: options.permissions ?? OWNER_PERMISSIONS,
    route: options.route ?? DETAILS,
    path: DETAILS,
  });
  return backend;
}

const lists = (backend: WipBackend) =>
  callsOf(backend, 'GET').filter((call) => call.path === '/wip/items');

const table = async () => {
  const element = await screen.findByRole('table', { name: 'WIP items' });
  await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));
  return element;
};

const rowsOf = (element: HTMLElement) => within(element).getAllByRole('row').slice(1);
const pick = (name: string) => screen.getByRole('checkbox', { name: `Select ${name}` });

describe('the WIP items', () => {
  it('lists the oldest first with their kind, client, job, person, hours, value and age', async () => {
    const backend = setup();
    const rows = rowsOf(await table());

    expect(lists(backend)[0]?.params?.get('sort')).toBe('date');
    expect(lists(backend)[0]?.params?.get('order')).toBe('asc');
    expect(rows).toHaveLength(5);
    const [vat, bank, disbursement, audit, fee] = rows as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ];
    expect(vat).toHaveTextContent('VAT return');
    expect(vat).toHaveTextContent('01/08/2026');
    expect(vat).toHaveTextContent('Acme Ltd');
    expect(vat).toHaveTextContent('J00001 Year-end accounts');
    expect(vat).toHaveTextContent('Ben Carter');
    expect(vat).toHaveTextContent('2.50');
    expect(vat).toHaveTextContent('£300.00');
    expect(vat).toHaveTextContent('78 days');
    expect(within(vat).getByRole('link', { name: 'J00001 Year-end accounts' })).toHaveAttribute(
      'href',
      '/acme/jobs/j-1',
    );
    expect(bank).toHaveTextContent('41 days');
    expect(disbursement).toHaveTextContent('Disbursement');
    expect(disbursement).toHaveTextContent('Companies House');
    expect(disbursement).toHaveTextContent('£13.00');
    expect(audit).toHaveTextContent('Globex plc');
    expect(fee).toHaveTextContent('Fixed fee');
    expect(fee).toHaveTextContent('Fee £2,400.00, recognised £1,200.00, billed £0.00');
    expect(screen.getByText('Showing 5 items · End of the list')).toBeInTheDocument();
  });

  it('shows what time on a fixed fee job is worth when the fee has replaced it', async () => {
    setup({ items: [item({ value: 0, charge_value: 18000, component: 'fixed_fee' })] });
    const rows = rowsOf(await table());
    expect(rows[0]).toHaveTextContent('£0.00');
    expect(rows[0]).toHaveTextContent('Worth £180.00');
  });

  it('narrows by kind, age and search, through the API', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('tab', { name: 'Time' }));
    await waitFor(() => expect(lists(backend).at(-1)?.params?.getAll('kind')).toEqual(['time']));
    await waitFor(() => expect(rowsOf(screen.getByRole('table'))).toHaveLength(3));

    await user.click(screen.getByRole('button', { name: /Filter/ }));
    const panel = await screen.findByRole('dialog', { name: 'Filter WIP items' });
    await user.selectOptions(within(panel).getByLabelText('Age'), 'Over 60 days old');
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('min_age_days')).toBe('61'));
    await waitFor(() => expect(rowsOf(screen.getByRole('table'))).toHaveLength(1));
    expect(screen.getByRole('table')).toHaveTextContent('VAT return');
    expect(screen.getByText(', 1 filters applied')).toBeInTheDocument();
  });

  it('sorts by the header the person clicks, through the API', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: /^Value/ }));
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('sort')).toBe('value'));
    expect(lists(backend).at(-1)?.params?.get('order')).toBe('asc');
  });

  it('opens with the filters of the address, as a link from the summary has them', async () => {
    const backend = setup({}, { route: `${DETAILS}?client_id=${IDS.globex}&kind=time` });
    await table();
    expect(lists(backend)[0]?.params?.get('client_id')).toBe(IDS.globex);
    expect(lists(backend)[0]?.params?.getAll('kind')).toEqual(['time']);
    await waitFor(() => expect(rowsOf(screen.getByRole('table'))).toHaveLength(1));
    expect(screen.getByRole('table')).toHaveTextContent('Audit planning');
  });

  it('says so when there is no WIP and when nothing matches', async () => {
    const user = userEvent.setup();
    setup({ items: [] });
    expect(await screen.findByText('No work in progress')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Adjustments' }));
    expect(await screen.findByText('No items match')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('No work in progress')).toBeInTheDocument();
  });
});

describe('writing items off', () => {
  it('writes off the items selected, with a reason, and takes them out of the list', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(pick('VAT return'));
    await user.click(pick('Bank reconciliation'));
    expect(screen.getByRole('status')).toHaveTextContent('2 selected, £480.00');
    await user.click(screen.getByRole('button', { name: 'Write off' }));

    const dialog = await screen.findByRole('dialog', { name: 'Write off WIP' });
    expect(dialog).toHaveTextContent('2 items worth £480.00 for Acme Ltd');
    await user.click(within(dialog).getByRole('button', { name: 'Write off' }));
    expect(await within(dialog).findByText('Say why the WIP is written off')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Reason'), 'Agreed with the client');
    await user.click(within(dialog).getByRole('button', { name: 'Write off' }));

    expect(await screen.findByText('WIP written off')).toBeInTheDocument();
    expect(callsOf(backend, 'POST')[0]).toMatchObject({
      path: '/wip/write-offs',
      body: {
        client_id: IDS.acme,
        items: [{ time_entry_id: 't-2' }, { time_entry_id: 't-1' }],
        reason: 'Agreed with the client',
      },
    });
    await waitFor(() => expect(rowsOf(screen.getByRole('table'))).toHaveLength(3));
    expect(screen.queryByText(/selected, £/)).not.toBeInTheDocument();
  });

  it('refuses items of two clients, and says why', async () => {
    const user = userEvent.setup();
    setup();
    await table();

    await user.click(pick('Bank reconciliation'));
    await user.click(pick('Audit planning'));
    const button = screen.getByRole('button', { name: 'Write off' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Select the items of one client to write them off.');
  });

  it('leaves a fixed fee out of what is taken, and says so', async () => {
    const user = userEvent.setup();
    setup();
    await table();

    await user.click(pick('Bank reconciliation'));
    await user.click(screen.getByRole('checkbox', { name: 'Select Fixed fee' }));
    expect(screen.getByRole('status')).toHaveTextContent('2 selected, £180.00');
    expect(screen.getByRole('status')).toHaveTextContent(
      '1 selected item is a fixed fee or an adjustment and cannot be taken out of WIP by id.',
    );
    expect(screen.getByRole('button', { name: 'Write off' })).toBeEnabled();
  });

  it('keeps the dialog open with the reason when the API refuses', async () => {
    const user = userEvent.setup();
    setup({
      refusals: {
        'POST /wip/write-offs': {
          status: 409,
          code: 'WIP_NOT_AVAILABLE',
          message: 'One of the items is no longer WIP.',
        },
      },
    });
    await table();

    await user.click(pick('Bank reconciliation'));
    await user.click(screen.getByRole('button', { name: 'Write off' }));
    const dialog = await screen.findByRole('dialog', { name: 'Write off WIP' });
    await user.type(within(dialog).getByLabelText('Reason'), 'Goodwill');
    await user.click(within(dialog).getByRole('button', { name: 'Write off' }));

    expect(
      await within(dialog).findByText('One of the items is no longer WIP.'),
    ).toBeInTheDocument();
  });
});

describe('transferring items', () => {
  it('moves the items selected to another job of the client', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(pick('VAT return'));
    await user.click(pick('Bank reconciliation'));
    await user.click(screen.getByRole('button', { name: 'Transfer' }));

    const dialog = await screen.findByRole('dialog', { name: 'Transfer WIP' });
    expect(dialog).toHaveTextContent('J00001 Year-end accounts');
    expect(dialog).toHaveTextContent('2 items worth £480.00');
    await user.click(within(dialog).getByRole('combobox', { name: 'To job' }));
    await user.click(await screen.findByRole('option', { name: /J00002/ }));
    await user.type(within(dialog).getByLabelText('Reason'), 'Booked to the wrong job');
    await user.click(within(dialog).getByRole('button', { name: 'Transfer WIP' }));

    expect(await screen.findByText('WIP transferred')).toBeInTheDocument();
    expect(callsOf(backend, 'POST')[0]).toMatchObject({
      path: '/wip/transfers',
      body: {
        from_job_id: 'j-1',
        to_job_id: 'j-2',
        items: [
          { kind: 'time', id: 't-2' },
          { kind: 'time', id: 't-1' },
        ],
        reason: 'Booked to the wrong job',
      },
    });
    expect(backend.transfers).toHaveLength(1);
  });

  it('refuses items of two jobs, and of two kinds of WIP', async () => {
    const user = userEvent.setup();
    setup();
    await table();

    await user.click(pick('Bank reconciliation'));
    await user.click(pick('Audit planning'));
    expect(screen.getByRole('button', { name: 'Transfer' })).toHaveAttribute(
      'title',
      'Select the items of one job to transfer them.',
    );

    await user.click(pick('Audit planning'));
    await user.click(screen.getByRole('checkbox', { name: 'Select Disbursement' }));
    expect(screen.getByRole('button', { name: 'Transfer' })).toHaveAttribute(
      'title',
      'Select one kind of WIP to transfer: time, or expenses.',
    );
  });
});

describe('the permissions', () => {
  it('shows a reader the items without the means to take any out', async () => {
    setup({}, { permissions: READ_ONLY });
    await table();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('offers only what the person may do', async () => {
    const user = userEvent.setup();
    setup({}, { permissions: [...READ_ONLY, 'wip.write_off'] });
    await table();
    await user.click(pick('Bank reconciliation'));
    expect(screen.getByRole('button', { name: 'Write off' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Transfer' })).not.toBeInTheDocument();
  });
});
