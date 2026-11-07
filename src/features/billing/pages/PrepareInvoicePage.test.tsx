import { focusManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { http } from 'msw';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath } from '@/test/renderInOrg';
import { ok, server } from '@/test/server';
import type { Organization } from '@/types/organization';

import { harbour } from '../test/fixtures';
import {
  accountsJob,
  createPrepareBackend,
  disbursementItem,
  fixedFeeItem,
  harbourItems,
  harbourSummary,
  jobBilling,
  postsOf,
  prepareHandlers,
  timeItem,
  vatJob,
  wipOf,
  type PrepareBackend,
} from '../test/prepare';
import { BILLING, renderBillingPage } from '../test/render';
import type { ClientWip, DefaultVat, JobBilling, VatOption } from '../types';
import PrepareInvoicePage from './PrepareInvoicePage';

const PREPARE = `${BILLING}/prepare`;
const NO_ISSUE = OWNER_PERMISSIONS.filter((permission) => permission !== 'invoice.issue');

function setup(
  init: Partial<PrepareBackend> = {},
  options: { permissions?: string[]; organization?: Partial<Organization>; route?: string } = {},
) {
  const backend = createPrepareBackend(init);
  server.use(...prepareHandlers(backend));
  renderBillingPage(<PrepareInvoicePage />, {
    permissions: options.permissions ?? OWNER_PERMISSIONS,
    organization: options.organization,
    route: options.route ?? `${PREPARE}?client=${harbour.id}`,
    path: PREPARE,
  });
  return backend;
}

const work = async () => {
  const element = await screen.findByRole('table', { name: 'Work in progress of Harbour & Co' });
  await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));
  return element;
};

const rowsOf = (element: HTMLElement) => within(element).getAllByRole('row').slice(1);
const rowOf = (element: HTMLElement, name: RegExp) => within(element).getByRole('row', { name });
/** The cells of line n of the grid, by their accessible names. */
const description = (n: number) =>
  screen.getByRole('textbox', { name: `Description of line ${n}` });
const amount = (n: number) => screen.getByRole('textbox', { name: `Amount to bill of line ${n}` });
const vatCode = (n: number) => screen.getByRole('combobox', { name: `VAT code of line ${n}` });
/** The VAT column: the amount, then the rate. */
const vatCell = (row: HTMLElement | undefined) =>
  within(row as HTMLElement).getAllByRole('cell')[5];

async function choose(user: ReturnType<typeof userEvent.setup>, ...names: RegExp[]) {
  const table = await work();
  for (const name of names) {
    await user.click(within(rowOf(table, name)).getByRole('checkbox'));
  }
}

async function review(user: ReturnType<typeof userEvent.setup>, ...names: RegExp[]) {
  await choose(user, ...names);
  await user.click(screen.getByRole('button', { name: 'Review the lines' }));
  return screen.findByRole('table', { name: 'Lines of the invoice' });
}

async function toDetails(user: ReturnType<typeof userEvent.setup>, ...names: RegExp[]) {
  await review(user, ...names);
  await user.click(screen.getByRole('button', { name: 'Dates and notes' }));
  return screen.findByRole('form', { name: 'Invoice details' });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('choosing the client', () => {
  it('asks for a client first', async () => {
    setup({}, { route: PREPARE });
    expect(await screen.findByText('Choose a client')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Steps' })).not.toBeInTheDocument();
  });

  it('opens the work of the client chosen in the picker', async () => {
    const user = userEvent.setup();
    setup({}, { route: PREPARE });

    await user.type(await screen.findByRole('combobox', { name: 'Client' }), 'Harb');
    await user.click(await screen.findByRole('option', { name: /Harbour & Co/ }));

    expect(await work()).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(`client=${harbour.id}`);
  });

  it('refuses a person who cannot prepare invoices', async () => {
    setup({}, { permissions: ['organization.read', 'client.read', 'wip.read', 'invoice.read'] });
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('the work to bill', () => {
  it('lists the time, the disbursement and the fixed fee, and sets aside what cannot be billed', async () => {
    const backend = setup();
    const table = await work();

    const rows = rowsOf(table);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toHaveTextContent('31/08/2026');
    expect(rows[0]).toHaveTextContent('Fixed fee');
    expect(rows[0]).toHaveTextContent('Partnership accounts');
    expect(rows[0]).toHaveTextContent('Fee £2,400.00, £400.00 billed so far');
    expect(rows[0]).toHaveTextContent('£2,000.00');
    expect(rows[1]).toHaveTextContent('Bookkeeping 2026/27');
    expect(rows[1]).toHaveTextContent('Bank reconciliation');
    expect(rows[1]).toHaveTextContent('Grace Hopper');
    expect(rows[1]).toHaveTextContent('1.50');
    expect(rows[1]).toHaveTextContent('£180.00');
    expect(rows[3]).toHaveTextContent('Disbursement');
    expect(rows[3]).toHaveTextContent('Filing fee · Companies House');
    // The time behind a recognised fixed fee is billed through the fee.
    expect(within(table).queryByText('Draft accounts')).not.toBeInTheDocument();

    expect(screen.getByText(/Harbour & Co has £/)).toHaveTextContent(
      'Harbour & Co has £2,665.40 of work in progress: 10.00 hours of time (£600.00) and £34.00 of disbursements.',
    );
    expect(
      screen.getByText('1 item in work in progress cannot be invoiced yet'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Train to Bath (Expense claim lines cannot be invoiced yet)'),
    ).toBeInTheDocument();
    expect(postsOf(backend, '/invoices')).toHaveLength(0);
  });

  it('narrows to one job and keeps what was chosen out of sight', async () => {
    const user = userEvent.setup();
    setup();
    const table = await work();
    await user.click(within(rowOf(table, /Bank reconciliation/)).getByRole('checkbox'));

    await user.selectOptions(screen.getByLabelText('Job'), 'VAT returns 2026/27');
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: /Work in progress/ }))).toHaveLength(1),
    );
    expect(screen.getByText('1 item chosen, £180.00 of work in progress.')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Select VAT returns 2026\/27/ }));
    expect(screen.getByText('2 items chosen, £240.00 of work in progress.')).toBeInTheDocument();
  });

  it('adds up what is chosen and offers the review only once something is', async () => {
    const user = userEvent.setup();
    setup();
    await work();
    expect(screen.getByText('Nothing chosen yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review the lines' })).toBeDisabled();

    await choose(user, /Bank reconciliation/, /Payroll queries/);
    expect(screen.getByText('2 items chosen, £300.00 of work in progress.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review the lines' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Clear choice' }));
    expect(screen.getByText('Nothing chosen yet.')).toBeInTheDocument();
  });

  it('warns that time on a fixed-fee job bills the fee', async () => {
    const user = userEvent.setup();
    setup({
      wip: {
        [harbour.id]: wipOf([
          timeItem({
            id: 't-9',
            job: { id: 'j-fix', number: 'J00009', name: 'Annual accounts', billing_basis: 'fixed' },
            component: 'fixed_fee',
            description: 'Trial balance',
          }),
        ]),
      },
    });
    const table = await work();
    expect(within(table).getByText('Fixed-fee time')).toBeInTheDocument();

    await user.click(within(rowOf(table, /Trial balance/)).getByRole('checkbox'));
    expect(
      screen.getByText(/bills the job's fixed fee less what is already billed/),
    ).toBeInTheDocument();
  });

  it('says when the client has nothing to bill', async () => {
    setup({ wip: { [harbour.id]: wipOf([]) } });
    expect(await screen.findByText('Nothing to bill')).toBeInTheDocument();
  });

  it('explains a failed load and tries again', async () => {
    const user = userEvent.setup();
    const backend = setup({
      refusals: { 'GET /clients/wip': { status: 500, code: 'INTERNAL_ERROR', message: 'Boom.' } },
    });
    expect(await screen.findByText('Could not load the work in progress')).toBeInTheDocument();

    backend.refusals = {};
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await work()).toBeInTheDocument();
  });
});

describe('reviewing the lines', () => {
  it('drafts one line per job with the hours, the work in progress and an estimate of VAT', async () => {
    const user = userEvent.setup();
    setup();
    const lines = await review(user, /Bank reconciliation/, /Payroll queries/);

    expect(screen.getByRole('list', { name: 'Steps' })).toBeInTheDocument();
    const rows = rowsOf(lines);
    expect(rows).toHaveLength(1);
    expect(description(1)).toHaveValue('Bookkeeping 2026/27 (7 Sep 2026 to 8 Sep 2026)');
    expect(rows[0]).toHaveTextContent('2.50');
    expect(amount(1)).toHaveValue('300.00');
    expect(vatCell(rows[0])).toHaveTextContent('£60.0020%');

    const totals = screen.getByLabelText('Totals');
    expect(totals).toHaveTextContent('Net£300.00');
    expect(totals).toHaveTextContent('VAT£60.00');
    expect(totals).toHaveTextContent('Total£360.00');
    const work = screen.getByLabelText('Work in progress');
    expect(work).toHaveTextContent('Work in progress cleared£300.00');
    expect(work).toHaveTextContent('Written on or off£0.00');
  });

  it('groups the time another way', async () => {
    const user = userEvent.setup();
    setup();
    await review(user, /Bank reconciliation/, /Payroll queries/);

    await user.selectOptions(screen.getByLabelText('Group the time'), 'One line per time entry');
    const rows = rowsOf(screen.getByRole('table', { name: 'Lines of the invoice' }));
    expect(rows).toHaveLength(2);
    expect(description(1)).toHaveValue('7 Sep 2026: Bank reconciliation');
    expect(description(2)).toHaveValue('8 Sep 2026: Payroll queries');

    await user.selectOptions(screen.getByLabelText('Group the time'), 'One line for all time');
    expect(rowsOf(screen.getByRole('table', { name: 'Lines of the invoice' }))).toHaveLength(1);
  });

  it('puts a disbursement on a line of its own', async () => {
    const user = userEvent.setup();
    setup();
    const lines = await review(user, /Bank reconciliation/, /Filing fee/);
    const rows = rowsOf(lines);
    expect(rows).toHaveLength(2);
    expect(description(2)).toHaveValue('Filing fee (Companies House)');
    expect(amount(2)).toHaveValue('34.00');
    expect(screen.getByLabelText('Totals')).toHaveTextContent('Net£214.00');
  });

  it('prices a fixed fee as the fee less what is billed already', async () => {
    const user = userEvent.setup();
    setup();
    const lines = await review(user, /Partnership accounts/);

    const rows = rowsOf(lines);
    expect(rows).toHaveLength(1);
    expect(description(1)).toHaveValue('Partnership accounts (fixed fee)');
    expect(amount(1)).toHaveValue('2000.00');
    expect(screen.getByLabelText('Totals')).toHaveTextContent('Net£2,000.00');
    expect(screen.queryByText(/priced when the draft is made/)).not.toBeInTheDocument();
  });

  it('writes work off when a line bills less than it is worth, and undoes the change', async () => {
    const user = userEvent.setup();
    setup();
    await review(user, /Bank reconciliation/, /Payroll queries/);

    // What a line of work bills is typed in its row; its hours and rate stay the work's.
    expect(screen.queryByRole('textbox', { name: /Quantity of line 1/ })).toBeNull();
    expect(screen.queryByRole('textbox', { name: /Unit price of line 1/ })).toBeNull();
    await user.clear(amount(1));
    await user.type(amount(1), '250');

    expect(screen.getByLabelText('Work in progress')).toHaveTextContent('Written off£50.00');
    const row = rowsOf(screen.getByRole('table', { name: 'Lines of the invoice' }))[0];
    expect(row).toHaveTextContent('Work £300.00, write-off £50.00');
    expect(screen.getByLabelText('Totals')).toHaveTextContent('Net£250.00');

    await user.click(screen.getByRole('button', { name: 'Undo the changes of line 1' }));
    expect(amount(1)).toHaveValue('300.00');
    expect(screen.getByLabelText('Totals')).toHaveTextContent('Net£300.00');
    expect(screen.queryByRole('button', { name: 'Undo the changes of line 1' })).toBeNull();
  });

  it('keeps the changes to the lines when the work is read again', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await review(user, /Bank reconciliation/, /Payroll queries/);
    await user.clear(amount(1));
    await user.type(amount(1), '250');
    await user.clear(description(1));
    await user.type(description(1), 'Quarterly bookkeeping');

    // Back on the tab the work is read again: unchanged, then with the time re-rated meanwhile.
    // The same work stays chosen, so what was typed on its lines stays.
    const reads = () =>
      backend.calls.filter((call) => call.method === 'GET' && call.path.endsWith('/wip')).length;
    const readAgain = async () => {
      const before = reads();
      act(() => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
      });
      await waitFor(() => expect(reads()).toBeGreaterThan(before));
    };
    await readAgain();
    expect(screen.getByLabelText('Work in progress')).toHaveTextContent('Written off£50.00');
    backend.wip[harbour.id] = wipOf(
      harbourItems().map((item) => ({ ...item, value: item.value + 6000 })),
    );
    await readAgain();
    await waitFor(() =>
      expect(screen.getByLabelText('Work in progress')).toHaveTextContent(
        'Work in progress cleared£420.00Written off£170.00',
      ),
    );
    expect(amount(1)).toHaveValue('250');
    expect(description(1)).toHaveValue('Quarterly bookkeeping');
    act(() => focusManager.setFocused(undefined));
  });

  it('changes the wording and the VAT code of a line', async () => {
    const user = userEvent.setup();
    setup();
    const lines = await review(user, /Bank reconciliation/);

    await user.clear(description(1));
    await user.type(description(1), 'Quarterly bookkeeping');
    await user.selectOptions(vatCode(1), 'Zero (0%)');

    const row = rowsOf(lines)[0];
    expect(description(1)).toHaveValue('Quarterly bookkeeping');
    expect(vatCell(row)).toHaveTextContent('£0.000%');
    expect(screen.getByLabelText('Totals')).toHaveTextContent('VAT£0.00');
  });

  it('adds lines that bill no work with + Row, drafted with the work', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await review(user, /Bank reconciliation/);
    // A line of work leaves by unticking the work, not from here.
    expect(screen.queryByRole('button', { name: 'Remove line 1' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Add row' }));
    // With work chosen, a line typed in is an ordinary fee unless ticked.
    expect(screen.getByRole('checkbox', { name: /Fees in advance/ })).not.toBeChecked();
    await user.type(description(2), 'Companies House filing');
    await user.clear(screen.getByRole('textbox', { name: /Quantity of line 2/ }));
    await user.type(screen.getByRole('textbox', { name: /Quantity of line 2/ }), '2');
    await user.type(screen.getByRole('textbox', { name: /Unit price of line 2/ }), '17');
    await user.selectOptions(vatCode(2), 'Zero (0%)');
    await user.click(screen.getByRole('button', { name: 'Add row' }));
    await user.type(description(3), 'Loyalty discount');
    await user.type(screen.getByRole('textbox', { name: /Unit price of line 3/ }), '-10');

    const rows = rowsOf(screen.getByRole('table', { name: 'Lines of the invoice' }));
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent('£34.00');
    // £180 and £34, less £10; VAT at 20% on the time and the discount, 0% on the filing.
    expect(screen.getByLabelText('Totals')).toHaveTextContent('Net£204.00VAT£34.00Total£238.00');
    expect(screen.getByLabelText('Work in progress')).toHaveTextContent(
      'Work in progress cleared£180.00',
    );

    await user.click(screen.getByRole('button', { name: 'Dates and notes' }));
    await user.click(await screen.findByRole('button', { name: 'Save as draft' }));
    await screen.findByText('Draft invoice saved');
    expect(postsOf(backend, '/invoices')[0]?.body).toMatchObject({
      time_entry_ids: ['t-1'],
      overrides: [],
      manual_lines: [
        {
          description: 'Companies House filing',
          quantity: '2.00',
          unit_amount: 1700,
          vat_rate_id: 'vat-zero',
        },
        { description: 'Loyalty discount', quantity: '1.00', unit_amount: -1000 },
      ],
    });
  });

  it('keeps the lines typed in when the work chosen changes', async () => {
    const user = userEvent.setup();
    setup();
    await review(user, /Bank reconciliation/);
    await user.click(screen.getByRole('button', { name: 'Add row' }));
    await user.type(description(2), 'Software licence');

    await user.click(screen.getByRole('button', { name: 'Back to the work' }));
    await choose(user, /Filing fee/);
    await user.click(screen.getByRole('button', { name: 'Review the lines' }));
    await screen.findByRole('table', { name: 'Lines of the invoice' });
    expect(description(1)).toHaveDisplayValue(/^Bookkeeping 2026\/27/);
    expect(description(2)).toHaveValue('Filing fee (Companies House)');
    expect(description(3)).toHaveValue('Software licence');
  });

  // APT63: the practice default is Flat VAT (7.5%) and the services carry Standard (20%). The
  // client's WIP says which code each drafted line gets; the grid shows exactly that.
  const standard: VatOption = {
    id: 'vat-std',
    name: 'Standard',
    code: 'standard',
    rate_bp: 2000,
    is_default: false,
    is_archived: false,
  };
  const flat: VatOption = {
    id: 'vat-flat',
    name: 'Flat VAT',
    code: 'standard',
    rate_bp: 750,
    is_default: true,
    is_archived: false,
  };
  const fromService: DefaultVat = { vat_rate_id: 'vat-std', rate_bp: 2000, source: 'service' };
  const fromPractice: DefaultVat = { vat_rate_id: 'vat-flat', rate_bp: 750, source: 'practice' };
  const accounts = { service_id: 's-accs', default_vat: fromService };
  const flatPractice = (): ClientWip => ({
    ...wipOf([
      timeItem({ id: 't-5', job: accountsJob, value: 0, component: 'fixed_fee', ...accounts }),
      timeItem({ id: 't-6', job: accountsJob, value: 0, component: 'fixed_fee', ...accounts }),
      fixedFeeItem(accounts),
      timeItem({ service_id: 's-books', default_vat: fromService }),
      // The job has no service: the practice default.
      timeItem({
        id: 't-4',
        date: '2026-10-01',
        job: vatJob,
        minutes: 30,
        hours: '0.50',
        value: 6000,
        charge_value: 6000,
        description: 'VAT return',
        default_vat: fromPractice,
      }),
      // A disbursement keeps its own code.
      disbursementItem({
        service_id: 's-books',
        default_vat: { vat_rate_id: 'vat-std', rate_bp: 2000, source: 'line' },
      }),
    ]),
    default_vat: fromPractice,
  });
  const gridRows = () => rowsOf(screen.getByRole('table', { name: 'Lines of the invoice' }));

  it('shows the VAT code the draft gives each line, and why, for every grouping', async () => {
    const user = userEvent.setup();
    setup({ vat: [standard, flat], wip: { [harbour.id]: flatPractice() } });
    await review(user, /Partnership accounts/, /Bank reconciliation/, /VAT return/, /Filing fee/);

    let rows = gridRows();
    expect(rows).toHaveLength(4);
    expect(description(1)).toHaveValue('Partnership accounts (fixed fee)');
    expect(vatCell(rows[0])).toHaveTextContent('£400.0020%Standard, the service’s code');
    expect(description(2)).toHaveDisplayValue(/^Bookkeeping 2026\/27/);
    expect(vatCell(rows[1])).toHaveTextContent('£36.0020%Standard, the service’s code');
    expect(description(3)).toHaveDisplayValue(/^VAT returns 2026\/27/);
    expect(vatCell(rows[2])).toHaveTextContent('£4.507.5%Flat VAT, the practice default');
    expect(description(4)).toHaveValue('Filing fee (Companies House)');
    expect(vatCell(rows[3])).toHaveTextContent('£6.8020%Standard, its own code');
    // £2,000, £180 and £34 at 20%, £60 at 7.5%.
    expect(screen.getByLabelText('Totals')).toHaveTextContent('VAT£447.30');

    await user.selectOptions(screen.getByLabelText('Group the time'), 'One line per time entry');
    rows = gridRows();
    expect(description(2)).toHaveValue('7 Sep 2026: Bank reconciliation');
    expect(vatCell(rows[1])).toHaveTextContent('20%Standard, the service’s code');
    expect(description(3)).toHaveValue('1 Oct 2026: VAT return');
    expect(vatCell(rows[2])).toHaveTextContent('7.5%Flat VAT, the practice default');

    // One line for time of two services has no service: the practice default.
    await user.selectOptions(screen.getByLabelText('Group the time'), 'One line for all time');
    rows = gridRows();
    expect(description(2)).toHaveDisplayValue(/^Professional services/);
    expect(vatCell(rows[1])).toHaveTextContent('7.5%Flat VAT, the practice default');
    expect(vatCell(rows[0])).toHaveTextContent('20%Standard, the service’s code');
  });

  it('names the default code of each line and keeps a chosen 7.5% as chosen', async () => {
    const user = userEvent.setup();
    const backend = setup({ vat: [standard, flat], wip: { [harbour.id]: flatPractice() } });
    await review(user, /Bank reconciliation/, /VAT return/);

    expect(vatCode(1)).toHaveValue('');
    expect(
      within(vatCode(1)).getByRole('option', {
        name: 'Default: Standard (20%), the service’s code',
      }),
    ).toBeInTheDocument();
    expect(
      within(vatCode(2)).getByRole('option', {
        name: 'Default: Flat VAT (7.5%), the practice default',
      }),
    ).toBeInTheDocument();

    await user.selectOptions(vatCode(1), 'Flat VAT (7.5%)');
    expect(vatCell(gridRows()[0])).toHaveTextContent('7.5%Flat VAT, chosen');
    // £180 and £60 at 7.5%.
    expect(screen.getByLabelText('Totals')).toHaveTextContent('VAT£18.00');

    await user.click(screen.getByRole('button', { name: 'Dates and notes' }));
    expect(await screen.findByText(/including VAT/)).toHaveTextContent(
      'about £258.00 including VAT',
    );
    await user.click(await screen.findByRole('button', { name: 'Save as draft' }));
    await screen.findByText('Draft invoice saved');
    expect(postsOf(backend, '/invoices')[0]?.body).toMatchObject({
      overrides: [{ time_entry_id: 't-1', vat_rate_id: 'vat-flat' }],
    });
  });

  it('charges no VAT when the practice is not VAT-registered, whatever the code', async () => {
    const user = userEvent.setup();
    const none: DefaultVat = { vat_rate_id: null, rate_bp: 0, source: null };
    setup(
      { wip: { [harbour.id]: wipOf([timeItem({ default_vat: none })]) } },
      { organization: { vat_registered: false } },
    );
    await review(user, /Bank reconciliation/);
    expect(vatCell(gridRows()[0])).toHaveTextContent('0%no VAT');
    expect(within(vatCode(1)).getByRole('option', { name: 'Default: No VAT' })).toBeInTheDocument();

    await user.selectOptions(vatCode(1), 'Standard (20%)');
    expect(vatCell(gridRows()[0])).toHaveTextContent('£0.000%Standard, chosen');
    expect(screen.getByLabelText('Totals')).toHaveTextContent('VAT£0.00');
  });

  it('refuses an amount that is not money', async () => {
    const user = userEvent.setup();
    setup();
    await review(user, /Bank reconciliation/);

    await user.clear(amount(1));
    await user.type(amount(1), 'lots');
    await user.click(screen.getByRole('button', { name: 'Dates and notes' }));

    expect(
      await screen.findByText('Enter the amount to bill, such as 120.00 (0 or more)'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Invoice details' })).toBeNull();
  });

  it('goes back to the work with the choice kept', async () => {
    const user = userEvent.setup();
    setup();
    await review(user, /Bank reconciliation/);

    await user.click(screen.getByRole('button', { name: 'Back to the work' }));
    await work();
    expect(screen.getByText('1 item chosen, £180.00 of work in progress.')).toBeInTheDocument();
  });
});

describe('making the draft', () => {
  it('saves a draft with the work chosen, the dates from the client\u2019s terms and the notes', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const form = await toDetails(user, /Bank reconciliation/, /Payroll queries/);

    expect(within(form).getByLabelText('Issue date')).toHaveValue('2026-10-18');
    expect(within(form).getByLabelText('Due date')).toHaveValue('2026-11-17');
    await user.type(within(form).getByLabelText('Reference'), 'PO-1234');
    await user.type(within(form).getByLabelText('Notes'), 'Thank you.');
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    expect(await screen.findByText('Draft invoice saved')).toBeInTheDocument();
    expect(screen.getByText('£360.00 to Harbour & Co')).toBeInTheDocument();
    expect(postsOf(backend, '/invoices')[0]?.body).toEqual({
      client_id: harbour.id,
      time_entry_ids: ['t-1', 't-2'],
      disbursement_ids: [],
      group_by: 'job',
      overrides: [],
      valuation_basis: 'contract',
      issue_date: '2026-10-18',
      due_date: '2026-11-17',
      reference: 'PO-1234',
      notes: 'Thank you.',
    });
    expect(postsOf(backend, '/invoices/inv-new-1/issue')).toHaveLength(0);
    expect(await screen.findByTestId('location')).toHaveTextContent(
      '/acme/billing/invoices/inv-new-1',
    );
  });

  it('sends only what the person changed as overrides, and the grouping chosen', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await review(user, /Bank reconciliation/, /Payroll queries/, /Filing fee/);
    await user.selectOptions(screen.getByLabelText('Group the time'), 'One line per time entry');

    expect(description(1)).toHaveValue('7 Sep 2026: Bank reconciliation');
    await user.clear(amount(1));
    await user.type(amount(1), '150.00');
    expect(screen.getByLabelText('Work in progress')).toHaveTextContent('Written off£30.00');

    await user.click(screen.getByRole('button', { name: 'Dates and notes' }));
    await user.click(await screen.findByRole('button', { name: 'Save as draft' }));
    await screen.findByText('Draft invoice saved');
    expect(postsOf(backend, '/invoices')[0]?.body).toMatchObject({
      time_entry_ids: ['t-1', 't-2'],
      disbursement_ids: ['d-1'],
      group_by: 'entry',
      overrides: [{ time_entry_id: 't-1', net_amount: 15000 }],
    });
  });

  it('bills a fixed fee through the time entries of its job', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await toDetails(user, /Partnership accounts/);
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    await screen.findByText('Draft invoice saved');
    expect(postsOf(backend, '/invoices')[0]?.body).toMatchObject({
      time_entry_ids: ['t-5', 't-6'],
      disbursement_ids: [],
      overrides: [],
    });
  });

  it('issues the invoice straight away when the person can issue', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await toDetails(user, /Bank reconciliation/);
    await user.click(screen.getByRole('button', { name: 'Save and issue' }));

    expect(await screen.findByText('Invoice INV-00099 issued')).toBeInTheDocument();
    expect(postsOf(backend, '/invoices')).toHaveLength(1);
    expect(postsOf(backend, '/invoices/inv-new-1/issue')[0]?.body).toEqual({
      issue_date: '2026-10-18',
      due_date: '2026-11-17',
    });
    expect(await screen.findByTestId('location')).toHaveTextContent(
      '/acme/billing/invoices/inv-new-1',
    );
  });

  it('emails the issued invoice too when the box is ticked', async () => {
    const user = userEvent.setup();
    const sent: string[] = [];
    const backend = setup();
    server.use(
      http.post(orgApiPath('/invoices/:invoiceId/send'), ({ params }) => {
        sent.push(String(params.invoiceId));
        return ok({
          invoice_id: String(params.invoiceId),
          to: ['a@harbour.example'],
          queued: true,
        });
      }),
    );
    await toDetails(user, /Bank reconciliation/);
    // The client has no invoice email, so the box starts empty.
    const box = screen.getByRole('checkbox', { name: /Email it to the client/ });
    expect(box).not.toBeChecked();
    await user.click(box);
    await user.click(screen.getByRole('button', { name: 'Save, issue and send' }));

    expect(await screen.findByText('Invoice email queued')).toBeInTheDocument();
    expect(postsOf(backend, '/invoices/inv-new-1/issue')).toHaveLength(1);
    expect(sent).toEqual(['inv-new-1']);
  });

  it('sends the draft for approval when the practice approves invoices first', async () => {
    const user = userEvent.setup();
    const backend = setup(
      { approvalRequired: true },
      { organization: { invoice_approval_required: true, invoice_approval_threshold: 0 } },
    );
    await toDetails(user, /Bank reconciliation/);

    expect(screen.queryByRole('button', { name: 'Save and issue' })).not.toBeInTheDocument();
    expect(
      screen.getByText(/approves invoices before they are issued: the draft is sent for approval/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save and send for approval' }));

    expect(await screen.findByText('Draft sent for approval')).toBeInTheDocument();
    expect(postsOf(backend, '/invoices/inv-new-1/submit')).toHaveLength(1);
    expect(postsOf(backend, '/invoices/inv-new-1/issue')).toHaveLength(0);
  });

  // The step's total is an estimate (an unpriced fixed fee counts as nothing): the draft the API
  // makes decides between issuing it and sending it for approval (BIL-05).
  it('sends the draft for approval when the API says it needs it, though the estimate did not', async () => {
    const user = userEvent.setup();
    const backend = setup(
      { approvalRequired: true },
      { organization: { invoice_approval_required: true, invoice_approval_threshold: 100000000 } },
    );
    await toDetails(user, /Bank reconciliation/);
    await user.click(screen.getByRole('button', { name: 'Save and issue' }));

    expect(await screen.findByText('Draft sent for approval')).toBeInTheDocument();
    expect(screen.getByText(/It needs approval before it is issued/)).toBeInTheDocument();
    expect(postsOf(backend, '/invoices/inv-new-1/submit')).toHaveLength(1);
    expect(postsOf(backend, '/invoices/inv-new-1/issue')).toHaveLength(0);
  });

  it('issues the draft when the API says it needs no approval, though the estimate did', async () => {
    const user = userEvent.setup();
    const backend = setup(
      { approvalRequired: false },
      { organization: { invoice_approval_required: true, invoice_approval_threshold: 0 } },
    );
    await toDetails(user, /Bank reconciliation/);
    await user.click(screen.getByRole('button', { name: 'Save and send for approval' }));

    expect(await screen.findByText('Invoice INV-00099 issued')).toBeInTheDocument();
    expect(postsOf(backend, '/invoices/inv-new-1/issue')).toHaveLength(1);
    expect(postsOf(backend, '/invoices/inv-new-1/submit')).toHaveLength(0);
  });

  it('offers only the draft to a person who cannot issue', async () => {
    const user = userEvent.setup();
    setup({}, { permissions: NO_ISSUE });
    await toDetails(user, /Bank reconciliation/);

    expect(screen.getByRole('button', { name: 'Save as draft' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save and issue' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save and send for approval' }),
    ).not.toBeInTheDocument();
  });

  it('refuses a due date before the issue date and sends nothing', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const form = await toDetails(user, /Bank reconciliation/);

    fireEvent.change(within(form).getByLabelText('Due date'), { target: { value: '2026-10-01' } });
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    expect(
      await within(form).findByText('The due date cannot be before the issue date'),
    ).toBeInTheDocument();
    expect(postsOf(backend, '/invoices')).toHaveLength(0);
  });

  it('shows what the API refuses and stays on the step', async () => {
    const user = userEvent.setup();
    const backend = setup({
      refusals: {
        'POST /invoices': {
          status: 409,
          code: 'WIP_NOT_AVAILABLE',
          message: 'Some of the work has been billed since you opened this page.',
        },
      },
    });
    await toDetails(user, /Bank reconciliation/);
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    expect(
      await screen.findByText('Some of the work has been billed since you opened this page.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Invoice details' })).toBeInTheDocument();
    expect(postsOf(backend, '/invoices')).toHaveLength(1);
    expect(screen.getByTestId('location')).toHaveTextContent('/acme/billing/prepare');
  });

  it('carries on from the draft when it was saved but could not be issued', async () => {
    const user = userEvent.setup();
    setup({
      refusals: {
        'POST /invoices/issue': {
          status: 409,
          code: 'PERIOD_LOCKED',
          message: 'The period is locked.',
        },
      },
    });
    await toDetails(user, /Bank reconciliation/);
    await user.click(screen.getByRole('button', { name: 'Save and issue' }));

    expect(await screen.findByText('The draft was saved but not issued')).toBeInTheDocument();
    expect(screen.getByText('The period is locked.')).toBeInTheDocument();
    expect(await screen.findByTestId('location')).toHaveTextContent(
      '/acme/billing/invoices/inv-new-1',
    );
  });
});

describe('the billing summary', () => {
  const jobsTable = async () => {
    const element = await screen.findByRole('table', { name: 'Jobs of the client' });
    return element;
  };

  it('lists each job with its terms and the hours spent, before anything is chosen', async () => {
    setup();
    await work();

    const rows = rowsOf(await jobsTable());
    expect(rows).toHaveLength(2);
    // Most work ready to bill first.
    expect(rows[0]).toHaveTextContent('Partnership accounts');
    expect(rows[0]).toHaveTextContent('Fixed £2,400.00');
    expect(rows[0]).toHaveTextContent('5:00');
    expect(rows[1]).toHaveTextContent('Bookkeeping 2026/27');
    expect(rows[1]).toHaveTextContent('Hourly');
    expect(rows[1]).toHaveTextContent('7:00');
    expect(rows[1]).toHaveTextContent('+1:00 awaiting approval');
  });

  it('totals the client above the jobs', async () => {
    setup();
    await work();

    const totals = screen.getByLabelText('Totals for the client');
    expect(totals).toHaveTextContent('Hours logged12:00');
    expect(totals).toHaveTextContent('Ready to bill8:00');
    expect(totals).toHaveTextContent('£2,394.00');
  });

  it('keeps the detailed figures behind Show/Hide Columns', async () => {
    const user = userEvent.setup();
    setup();
    await work();

    const table = await jobsTable();
    expect(
      within(table).queryByRole('columnheader', { name: /Non-billable/ }),
    ).not.toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: /Actual cost/ })).toBeInTheDocument();

    const summary = screen.getByRole('region', { name: 'Billing summary' });
    await user.click(within(summary).getByRole('button', { name: 'Show/Hide Columns' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Time at company rates' }));

    const books = rowsOf(table)[1] as HTMLElement;
    expect(books).toHaveTextContent('£120.00');
  });

  it('shows five jobs at first, with search and a way to see the rest', async () => {
    const user = userEvent.setup();
    const summary = harbourSummary();
    const template = summary.jobs[0] as JobBilling;
    summary.jobs = Array.from({ length: 12 }, (_, index) => ({
      ...template,
      job_id: `j-${String(index)}`,
      number: `J${String(100 + index)}`,
      name: `Client job ${String(index + 1)}`,
      breakdown: { ...template.breakdown, ready_minutes: index === 11 ? 600 : 0 },
    }));
    setup({ summary: { [harbour.id]: summary } });
    await work();

    const table = await jobsTable();
    expect(rowsOf(table)).toHaveLength(5);
    // Sorted by work ready to bill: the one with work comes first.
    expect(rowsOf(table)[0]).toHaveTextContent('Client job 12');
    expect(screen.getByText('12 jobs')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show 7 more' }));
    expect(rowsOf(await jobsTable())).toHaveLength(12);

    await user.type(screen.getByRole('searchbox', { name: 'Search jobs' }), 'job 3');
    expect(rowsOf(await jobsTable())).toHaveLength(1);
  });

  it('can be limited to the jobs with work ready to bill', async () => {
    const user = userEvent.setup();
    const summary = harbourSummary();
    const idle = jobBilling({
      job_id: 'j-idle',
      number: 'J00009',
      name: 'Idle job',
      breakdown: { ...(summary.jobs[0] as JobBilling).breakdown, ready_minutes: 0, other_costs: 0 },
    });
    summary.jobs = [...summary.jobs, idle];
    setup({ summary: { [harbour.id]: summary } });
    await work();

    expect(rowsOf(await jobsTable())).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Work ready to bill only' }));
    expect(rowsOf(await jobsTable())).toHaveLength(2);
  });

  it('shows the hours even when there is nothing to bill', async () => {
    const empty = wipOf([]);
    const summary = harbourSummary();
    setup({ wip: { [harbour.id]: empty }, summary: { [harbour.id]: summary } });

    expect(await screen.findByText('Nothing to bill')).toBeInTheDocument();
    expect(rowsOf(await jobsTable())[0]).toHaveTextContent('Partnership accounts');
  });

  it('offers the three bases with what each would bill', async () => {
    setup();
    await work();

    const picker = screen.getByRole('group', { name: 'Value the invoice on' });
    expect(within(picker).getByRole('button', { name: /Contract value £2,394.00/ })).toBeVisible();
    expect(within(picker).getByRole('button', { name: /Job value £2,534.00/ })).toBeVisible();
    expect(within(picker).getByRole('button', { name: /Team value £354.00/ })).toBeVisible();
  });

  it('bills the cost of the team when the team value is chosen', async () => {
    const user = userEvent.setup();
    setup();
    await work();

    await user.click(screen.getByRole('button', { name: /Team value/ }));
    const lines = await review(user, /Bank reconciliation/, /Payroll queries/);

    // 1.5 hours cost £60 and 1 hour £40: the line bills the cost, not the £300 of the rates.
    const rows = rowsOf(lines);
    expect(rows).toHaveLength(1);
    expect(amount(1)).toHaveValue('100.00');
    expect(screen.getByLabelText('Totals')).toHaveTextContent('Net£100.00');
  });

  it('bills the value set for the job when the job value is chosen', async () => {
    const user = userEvent.setup();
    setup();
    await work();

    await user.click(screen.getByRole('button', { name: /Job value/ }));
    await review(user, /Bank reconciliation/);

    // The fee budget of £500, less nothing billed so far: the time line bills that.
    expect(amount(1)).toHaveValue('500.00');
  });

  it('sends the basis the invoice was valued on with the draft', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await work();

    await user.click(screen.getByRole('button', { name: /Team value/ }));
    await toDetails(user, /Bank reconciliation/);
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    await screen.findByText('Draft invoice saved');
    expect(postsOf(backend, '/invoices')[0]?.body).toMatchObject({ valuation_basis: 'team' });
  });

  it('keeps the contract value as the default, which changes nothing', async () => {
    const user = userEvent.setup();
    setup();
    await review(user, /Bank reconciliation/);
    expect(amount(1)).toHaveValue('180.00');
  });

  it('compares the invoice with the recovery rate, the staff rates and cost plus', async () => {
    const user = userEvent.setup();
    setup();
    await work();

    // Contract value £2,394.00 less £34.00 of other costs: £2,360.00 for the work itself.
    let panel = screen.getByRole('region', { name: 'Recovery of this invoice' });
    expect(panel).toHaveTextContent('This invoice (contract value)£2,360.00');
    expect(panel).toHaveTextContent('Before £34.00 of other costs');
    expect(panel).toHaveTextContent('Potential recovery£960.00£1,400.00 over');
    expect(panel).toHaveTextContent(
      'Client job-specific rate, then task-specific rate, then staff charge-out rate',
    );
    expect(panel).toHaveTextContent('8:00 at task rates');
    expect(panel).toHaveTextContent('At staff rates£800.00£1,560.00 over');
    expect(panel).toHaveTextContent('Cost plus 50%£480.00£1,880.00 over');

    // Billed at the team's cost (£320.00) the work leaves £640.00 on the table at the recovery rate.
    await user.click(screen.getByRole('button', { name: /Team value/ }));
    panel = screen.getByRole('region', { name: 'Recovery of this invoice' });
    expect(panel).toHaveTextContent('This invoice (team value)£320.00');
    expect(panel).toHaveTextContent('Potential recovery£960.00£640.00 left on the table');
    expect(panel).toHaveTextContent('At staff rates£800.00£480.00 left on the table40% recovered');
  });

  it('does not offer the team value to someone who cannot see cost', async () => {
    const summary = harbourSummary();
    summary.show_cost = false;
    summary.time_costs = null;
    summary.totals.basis_values.team = null;
    setup({ summary: { [harbour.id]: summary } });
    await work();

    const picker = screen.getByRole('group', { name: 'Value the invoice on' });
    expect(within(picker).queryByRole('button', { name: /Team value/ })).not.toBeInTheDocument();
  });
});

describe('time picked on the Time Entries page', () => {
  it('opens with that time already chosen', async () => {
    setup({}, { route: `${PREPARE}?client=${harbour.id}&time=t-1,t-2` });

    const table = await work();
    await waitFor(() =>
      expect(screen.getByText('2 items chosen, £300.00 of work in progress.')).toBeInTheDocument(),
    );
    expect(within(rowOf(table, /Bank reconciliation/)).getByRole('checkbox')).toBeChecked();
    expect(within(rowOf(table, /Payroll queries/)).getByRole('checkbox')).toBeChecked();
    expect(within(rowOf(table, /VAT workings/)).getByRole('checkbox')).not.toBeChecked();
  });

  it('chooses nothing for time that is not in the client’s work in progress', async () => {
    setup({}, { route: `${PREPARE}?client=${harbour.id}&time=somebody-else` });

    await work();
    expect(screen.getByText('Nothing chosen yet.')).toBeInTheDocument();
  });
});
