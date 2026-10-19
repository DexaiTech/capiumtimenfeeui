import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { tokenStore } from '@/services/api';
import { OWNER_PERMISSIONS, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { fail, ok, server } from '@/test/server';

import {
  claim as makeClaim,
  event,
  IDS,
  line as makeLine,
  receipt as makeReceipt,
} from '../test/fixtures';
import { createBackend, expenseHandlers, orgApiPath, type ExpenseBackend } from '../test/handlers';
import {
  chooseReceipts,
  EXPENSES,
  installObjectUrls,
  pdfFile,
  pngFile,
  renderExpensePage,
} from '../test/render';
import type { ExpenseClaimDetail } from '../types';
import ExpenseClaimDetailPage from './ExpenseClaimDetailPage';

let urls: ReturnType<typeof installObjectUrls>;
beforeEach(() => {
  urls = installObjectUrls();
});
afterEach(() => {
  urls.restore();
});

const DAY = '2026-09-07';

interface Setup {
  claim: ExpenseClaimDetail;
  permissions?: string[];
  list?: 'mine' | 'claims' | 'approvals';
  backend?: Partial<ExpenseBackend>;
}

function setup({ claim, permissions = STAFF_PERMISSIONS, list = 'mine', backend: init }: Setup) {
  const backend = createBackend({ claims: [claim], ...init });
  server.use(...expenseHandlers(backend));
  const view = renderExpensePage(<ExpenseClaimDetailPage />, {
    permissions,
    route: `${EXPENSES}/${list}/${claim.id}`,
    path: `${EXPENSES}/${list}/:claimId`,
  });
  return { backend, view };
}

const draft = (overrides: Partial<Parameters<typeof makeClaim>[0]> = {}) =>
  makeClaim({
    lines: [
      makeLine({ id: 'l-train', description: 'Train to Leeds', receipt_count: 0 }),
      makeLine({
        id: 'l-taxi',
        description: 'Taxi',
        net: 1000,
        gross: 1000,
        recharge_amount: 1100,
        receipt_required: false,
        incurred_on: '2026-09-08',
      }),
    ],
    ...overrides,
  });

const linesTable = () => screen.findByRole('table', { name: 'Expenses in this claim' });
const dialog = (name: string) => screen.findByRole('dialog', { name });
const lineMenu = async (user: ReturnType<typeof userEvent.setup>, description: string) => {
  await user.click(await screen.findByRole('button', { name: `Actions for ${description}` }));
};

describe('a claim on its page', () => {
  it('shows the claim with its lines, totals and where to go back to', async () => {
    setup({ claim: draft() });

    expect(await screen.findByRole('heading', { level: 1, name: 'Client visit, Leeds' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to My Expenses' })).toHaveAttribute(
      'href',
      '/acme/expenses/mine',
    );
    const table = await linesTable();
    const train = within(table).getByRole('row', { name: /Train to Leeds/ });
    expect(train).toHaveTextContent('07/09/2026');
    expect(train).toHaveTextContent('Travel · LNER');
    expect(train).toHaveTextContent('Acme Ltd');
    expect(train).toHaveTextContent('£43.00');
    expect(train).toHaveTextContent('£47.30');
    expect(within(train).getByRole('button', { name: 'Receipts for Train to Leeds (0)' })).toHaveTextContent('Needed');
    const totals = screen.getByLabelText('Totals of the claim');
    expect(totals).toHaveTextContent('Gross£53.00');
    expect(totals).toHaveTextContent('Recharged to clients£58.30');
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('2 expenses')).toBeInTheDocument();
  });

  it('warns about the expenses above the receipt limit that have none', async () => {
    setup({ claim: draft() });

    const warning = await screen.findByText(/1 expense is above £25.00 and needs a receipt/);
    expect(warning).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add receipts' })).toBeInTheDocument();
  });

  it('shows why a claim was returned, and its history', async () => {
    setup({
      claim: draft({
        status: 'returned',
        decided_by_name: 'Ben Carter',
        decided_at: '2026-10-12T10:00:00Z',
        decision_note: 'Please add the receipt for the train.',
        events: [
          event({ id: 'e1', action: 'submitted', created_at: '2026-10-11T09:30:00Z' }),
          event({
            id: 'e2',
            action: 'returned',
            actor_name: 'Ben Carter',
            note: 'Please add the receipt for the train.',
            created_at: '2026-10-12T10:00:00Z',
          }),
        ],
      }),
    });

    expect(
      await screen.findByText(/Returned by Ben Carter on 12\/10\/2026 11:00/),
    ).toBeInTheDocument();
    const history = screen.getByRole('list', { name: 'History of the claim' });
    const entries = within(history).getAllByRole('listitem');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent('Submitted by Ada Lovelace');
    expect(entries[1]).toHaveTextContent('Returned by Ben Carter');
    expect(entries[1]).toHaveTextContent('Please add the receipt for the train.');
    // A returned claim is edited and submitted again.
    expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeInTheDocument();
  });

  it('offers only what the claim allows: an approved claim of a plain member is read-only', async () => {
    setup({ claim: draft({ status: 'approved' }) });

    await linesTable();
    for (const name of ['Submit for approval', 'Add expense', 'Edit title', 'Recall', 'Delete claim', 'Approve', 'Return']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    const user = userEvent.setup();
    await lineMenu(user, 'Train to Leeds');
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Receipts']);
    expect(screen.getByRole('columnheader', { name: 'Billing' })).toBeInTheDocument();
  });

  it('says so when the claim does not exist', async () => {
    const claim = draft();
    server.use(
      http.get(orgApiPath('/expense-claims/:claimId'), () =>
        fail(404, 'RESOURCE_NOT_FOUND', 'Expense claim not found.'),
      ),
    );
    renderExpensePage(<ExpenseClaimDetailPage />, {
      permissions: STAFF_PERMISSIONS,
      route: `${EXPENSES}/mine/${claim.id}`,
      path: `${EXPENSES}/mine/:claimId`,
    });

    expect(await screen.findByText('This claim does not exist')).toBeInTheDocument();
  });

  it("explains a claim of someone else the caller may not see", async () => {
    const claim = draft();
    server.use(
      http.get(orgApiPath('/expense-claims/:claimId'), () =>
        fail(403, 'PERMISSION_DENIED', 'You may not see this claim.'),
      ),
    );
    renderExpensePage(<ExpenseClaimDetailPage />, {
      permissions: STAFF_PERMISSIONS,
      route: `${EXPENSES}/mine/${claim.id}`,
      path: `${EXPENSES}/mine/:claimId`,
    });

    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
  });
});

describe('adding an expense', () => {
  async function openForm(user: ReturnType<typeof userEvent.setup>) {
    // An empty claim offers the button twice: in the header and in the empty state.
    const [header] = await screen.findAllByRole('button', { name: 'Add expense' });
    await user.click(header as HTMLElement);
    return dialog('Add expense');
  }

  it('sends the amount typed and the VAT code, and shows the line the API stored', async () => {
    const user = userEvent.setup();
    const { backend } = setup({ claim: draft({ lines: [] }) });
    const form = await openForm(user);

    await user.selectOptions(within(form).getByLabelText('Expense type'), 'Subsistence');
    fireEvent.change(within(form).getByLabelText('Date'), { target: { value: DAY } });
    await user.type(within(form).getByLabelText('Description'), 'Lunch with the client');
    await user.type(within(form).getByLabelText('Net (£)'), '12.50');

    // The type's VAT code is chosen, and the VAT and gross follow the net.
    expect(within(form).getByLabelText('VAT code')).toHaveValue(IDS.standardVat);
    expect(within(form).getByLabelText('VAT (£)')).toHaveValue('2.50');
    expect(within(form).getByLabelText('Gross (£)')).toHaveValue('15.00');
    expect(within(form).getByText('It comes to £12.50 net, £2.50 VAT and £15.00 gross.')).toBeInTheDocument();

    await user.click(within(form).getByRole('button', { name: 'Add expense' }));

    expect(await screen.findByText('Expense added')).toBeInTheDocument();
    const post = backend.calls.find((call) => call.method === 'POST' && call.path.endsWith('/lines'));
    expect(post?.body).toEqual({
      expense_type_id: IDS.subsistence,
      incurred_on: DAY,
      description: 'Lunch with the client',
      payer: 'staff',
      is_billable: false,
      vat_rate_id: IDS.standardVat,
      net: 1250,
    });
    const row = within(await linesTable()).getByRole('row', { name: /Lunch with the client/ });
    expect(row).toHaveTextContent('£15.00');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('links net, VAT and gross as they are typed', async () => {
    const user = userEvent.setup();
    setup({ claim: draft({ lines: [] }) });
    const form = await openForm(user);
    await user.selectOptions(within(form).getByLabelText('Expense type'), 'Subsistence');
    const net = within(form).getByLabelText('Net (£)');
    const vat = within(form).getByLabelText('VAT (£)');
    const gross = within(form).getByLabelText('Gross (£)');

    await user.type(net, '100');
    expect([vat, gross].map((field) => (field as HTMLInputElement).value)).toEqual(['20.00', '120.00']);

    // Typing the gross works out the VAT contained in it and the net.
    await user.clear(gross);
    await user.type(gross, '60');
    expect([net, vat].map((field) => (field as HTMLInputElement).value)).toEqual(['50.00', '10.00']);

    // A VAT typed by hand keeps the net and moves the gross.
    await user.clear(net);
    await user.type(net, '50');
    await user.clear(vat);
    await user.type(vat, '9.99');
    expect((gross as HTMLInputElement).value).toBe('59.99');

    // Another VAT code works the VAT out again.
    await user.selectOptions(within(form).getByLabelText('VAT code'), 'Zero rate (0%)');
    expect([vat, gross].map((field) => (field as HTMLInputElement).value)).toEqual(['0.00', '50.00']);
  });

  it('prices a mileage expense from the miles at the practice rate', async () => {
    const user = userEvent.setup();
    const { backend } = setup({ claim: draft({ lines: [] }) });
    const form = await openForm(user);

    await user.selectOptions(within(form).getByLabelText('Expense type'), 'Mileage');
    expect(within(form).queryByLabelText('Net (£)')).not.toBeInTheDocument();
    expect(within(form).getByText('Priced at 45p a mile.')).toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText('Date'), { target: { value: DAY } });
    await user.type(within(form).getByLabelText('Description'), 'Drive to Leeds');
    await user.type(within(form).getByLabelText('Miles'), '42.5');
    expect(within(form).getByText('It comes to £19.13 net, £0.00 VAT and £19.13 gross.')).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Add expense' }));

    await screen.findByText('Expense added');
    const post = backend.calls.find((call) => call.method === 'POST' && call.path.endsWith('/lines'));
    expect(post?.body).toMatchObject({ expense_type_id: IDS.mileage, miles: '42.5' });
    expect(post?.body).not.toHaveProperty('net');
    expect(within(await linesTable()).getByRole('row', { name: /Drive to Leeds/ })).toHaveTextContent('42.5 miles');
  });

  it('starts a billable expense for a client from the type, and lets a manager set the recharge', async () => {
    const user = userEvent.setup();
    const { backend } = setup({ claim: draft({ lines: [] }), permissions: OWNER_PERMISSIONS });
    const form = await openForm(user);

    await user.selectOptions(within(form).getByLabelText('Expense type'), 'Travel');
    const billable = within(form).getByRole('switch', { name: 'Billable to the client' });
    expect(billable).toBeDisabled();
    await user.click(within(form).getByRole('combobox', { name: 'Client' }));
    await user.click(await screen.findByRole('option', { name: /Acme Ltd/ }));
    // Travel is billable by default, so a client makes the expense billable.
    await waitFor(() => expect(billable).toBeChecked());

    fireEvent.change(within(form).getByLabelText('Date'), { target: { value: DAY } });
    await user.type(within(form).getByLabelText('Description'), 'Train');
    await user.type(within(form).getByLabelText('Net (£)'), '43');
    expect(
      within(form).getByLabelText('Recharge amount (£)').closest('div')?.parentElement,
    ).toHaveTextContent('Leave empty to charge £47.30');
    await user.type(within(form).getByLabelText('Recharge amount (£)'), '50');
    await user.click(within(form).getByRole('button', { name: 'Add expense' }));

    await screen.findByText('Expense added');
    const post = backend.calls.find((call) => call.method === 'POST' && call.path.endsWith('/lines'));
    expect(post?.body).toMatchObject({
      client_id: IDS.acme,
      is_billable: true,
      net: 4300,
      recharge_amount: 5000,
    });
  });

  it('asks for what is missing before sending anything', async () => {
    const user = userEvent.setup();
    const { backend } = setup({ claim: draft({ lines: [] }) });
    const form = await openForm(user);

    await user.click(within(form).getByRole('button', { name: 'Add expense' }));

    expect(await within(form).findByText('Choose the type of expense')).toBeInTheDocument();
    expect(within(form).getByText('Describe the expense')).toBeInTheDocument();
    expect(within(form).getByText('Enter the net or the gross amount')).toBeInTheDocument();
    expect(backend.calls.filter((call) => call.method === 'POST')).toHaveLength(0);

    // Not in the future, and miles must be sensible.
    await user.selectOptions(within(form).getByLabelText('Expense type'), 'Mileage');
    fireEvent.change(within(form).getByLabelText('Date'), { target: { value: '2999-01-01' } });
    await user.type(within(form).getByLabelText('Miles'), '1.234');
    await user.click(within(form).getByRole('button', { name: 'Add expense' }));
    expect(await within(form).findByText('The date cannot be in the future')).toBeInTheDocument();
    expect(
      within(form).getByText('Enter the miles, for example 42.5 (more than 0, two decimals at most)'),
    ).toBeInTheDocument();
  });

  it('puts the refusals of the API on the fields they are about', async () => {
    const user = userEvent.setup();
    const { backend } = setup({ claim: draft({ lines: [] }) });
    server.use(
      http.post(orgApiPath('/expense-claims/:claimId/lines'), () =>
        fail(422, 'VALIDATION_ERROR', 'Some fields are not valid.', {
          details: [{ field: 'net', code: 'too_large', message: 'The amount is too large.' }],
        }),
      ),
    );
    const form = await openForm(user);
    await user.selectOptions(within(form).getByLabelText('Expense type'), 'Subsistence');
    fireEvent.change(within(form).getByLabelText('Date'), { target: { value: DAY } });
    await user.type(within(form).getByLabelText('Description'), 'Dinner');
    await user.type(within(form).getByLabelText('Net (£)'), '12.50');
    await user.click(within(form).getByRole('button', { name: 'Add expense' }));

    expect(await within(form).findByText('The amount is too large.')).toBeInTheDocument();
    expect(backend.calls.filter((call) => call.method === 'POST')).toHaveLength(0);

    server.use(
      http.post(orgApiPath('/expense-claims/:claimId/lines'), () =>
        fail(409, 'PERIOD_LOCKED', 'The period up to 31/08/2026 is locked.'),
      ),
    );
    await user.clear(within(form).getByLabelText('Net (£)'));
    await user.type(within(form).getByLabelText('Net (£)'), '10');
    await user.click(within(form).getByRole('button', { name: 'Add expense' }));
    expect(await within(form).findByText('The period up to 31/08/2026 is locked.')).toBeInTheDocument();
  });
});

describe('changing and deleting an expense', () => {
  it('sends only the fields that changed', async () => {
    const user = userEvent.setup();
    const { backend } = setup({ claim: draft() });
    await lineMenu(user, 'Train to Leeds');
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const form = await dialog('Edit expense');

    expect(within(form).getByLabelText('Description')).toHaveValue('Train to Leeds');
    expect(within(form).getByLabelText('Net (£)')).toHaveValue('43.00');
    expect(within(form).getByRole('button', { name: 'Save expense' })).toBeDisabled();
    await user.clear(within(form).getByLabelText('Description'));
    await user.type(within(form).getByLabelText('Description'), 'Train to York');
    await user.click(within(form).getByRole('button', { name: 'Save expense' }));

    expect(await screen.findByText('Expense saved')).toBeInTheDocument();
    const patch = backend.calls.find((call) => call.method === 'PATCH');
    expect(patch?.path).toBe(`/expense-claims/${backend.claims[0]?.id ?? ''}/lines/l-train`);
    expect(patch?.body).toEqual({ description: 'Train to York' });
    expect(await screen.findByRole('row', { name: /Train to York/ })).toBeInTheDocument();
  });

  it('sends the amounts when they were typed and lets the API price the rest', async () => {
    const user = userEvent.setup();
    const { backend } = setup({ claim: draft() });
    await lineMenu(user, 'Taxi');
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const form = await dialog('Edit expense');

    await user.clear(within(form).getByLabelText('Net (£)'));
    await user.type(within(form).getByLabelText('Net (£)'), '12.00');
    await user.click(within(form).getByRole('button', { name: 'Save expense' }));

    await screen.findByText('Expense saved');
    expect(backend.calls.find((call) => call.method === 'PATCH')?.body).toEqual({ net: 1200 });
  });

  it('deletes an expense after a confirmation that names it', async () => {
    const user = userEvent.setup();
    const { backend } = setup({ claim: draft() });
    await lineMenu(user, 'Taxi');
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const confirm = await dialog('Delete this expense?');
    expect(confirm).toHaveTextContent('Taxi (£10.00) will be removed from the claim, with its receipts.');
    await user.click(within(confirm).getByRole('button', { name: 'Delete expense' }));

    expect(await screen.findByText('Expense deleted')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('row', { name: /Taxi/ })).not.toBeInTheDocument());
    expect(backend.calls.some((call) => call.method === 'DELETE')).toBe(true);
  });

  it('renames the claim', async () => {
    const user = userEvent.setup();
    const { backend } = setup({ claim: draft() });
    await user.click(await screen.findByRole('button', { name: 'Edit title' }));
    const form = await dialog('Edit title');
    await user.clear(within(form).getByLabelText('Title'));
    await user.type(within(form).getByLabelText('Title'), 'Leeds, September');
    await user.click(within(form).getByRole('button', { name: 'Save title' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Leeds, September' })).toBeInTheDocument();
    expect(backend.calls.find((call) => call.method === 'PATCH')?.body).toEqual({ title: 'Leeds, September' });
  });

  it('deletes a draft claim after a confirmation and goes back to the list', async () => {
    const user = userEvent.setup();
    const { backend } = setup({ claim: draft() });
    await user.click(await screen.findByRole('button', { name: 'Delete claim' }));
    const confirm = await dialog('Delete this claim?');
    expect(confirm).toHaveTextContent('Client visit, Leeds and its 2 expenses will be removed');
    await user.click(within(confirm).getByRole('button', { name: 'Delete claim' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/acme/expenses/mine'));
    expect(backend.claims).toHaveLength(0);
  });
});

describe('submitting a claim', () => {
  it('lists the expenses that need a receipt when the API refuses, and lets the receipt be added', async () => {
    const user = userEvent.setup();
    const { backend } = setup({ claim: draft() });
    backend.nextUpload = { file_name: 'ticket.png', content_type: 'image/png', size_bytes: 69 };
    await user.click(await screen.findByRole('button', { name: 'Submit for approval' }));

    const blocked = await dialog('Receipts are missing');
    expect(blocked).toHaveTextContent('Expenses above £25.00 need a receipt before the claim can be submitted.');
    const list = within(blocked).getByRole('list', { name: 'Expenses without a receipt' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(list).toHaveTextContent('Train to Leeds');
    // The row of the table points at it, too.
    expect(within(await linesTable()).getByText('Receipt needed')).toBeInTheDocument();

    await user.click(within(blocked).getByRole('button', { name: 'Add a receipt for Train to Leeds' }));
    const receipts = await dialog('Receipts');
    chooseReceipts(pngFile('ticket.png'));
    expect(await within(receipts).findByRole('list', { name: 'Receipts' })).toHaveTextContent('ticket.png');
    await user.click(within(receipts).getByRole('button', { name: 'Done' }));

    await user.click(await screen.findByRole('button', { name: 'Submit for approval' }));
    expect(await screen.findByText('Claim submitted')).toBeInTheDocument();
    // The status badge and the history entry both say Submitted.
    expect(await screen.findAllByText('Submitted')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Submit for approval' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recall' })).toBeInTheDocument();
    expect(backend.calls.filter((call) => call.path.endsWith('/submit'))).toHaveLength(2);
  });

  it('says why a claim without expenses cannot be submitted', async () => {
    const user = userEvent.setup();
    setup({ claim: draft({ lines: [] }) });
    await user.click(await screen.findByRole('button', { name: 'Submit for approval' }));

    expect(await screen.findByText('Could not submit the claim')).toBeInTheDocument();
    expect(screen.getByText('Add at least one expense first.')).toBeInTheDocument();
  });

  it('recalls a submitted claim, which is a draft again', async () => {
    const user = userEvent.setup();
    const { backend } = setup({ claim: draft({ status: 'submitted' }) });
    await user.click(await screen.findByRole('button', { name: 'Recall' }));

    expect(await screen.findByText('Claim recalled')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Submit for approval' })).toBeInTheDocument();
    expect(backend.claims[0]?.status).toBe('draft');
  });
});

describe('the receipts of an expense', () => {
  const withReceipt = () =>
    draft({
      lines: [
        makeLine({
          id: 'l-train',
          description: 'Train to Leeds',
          receipts: [makeReceipt({ id: 'r-1', file_name: 'train-ticket.png' })],
        }),
      ],
    });

  async function openReceipts(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Receipts for Train to Leeds (1)' }));
    return dialog('Receipts');
  }

  it('lists the files with their size and who added them', async () => {
    const user = userEvent.setup();
    setup({ claim: withReceipt() });
    const receipts = await openReceipts(user);

    const list = within(receipts).getByRole('list', { name: 'Receipts' });
    expect(list).toHaveTextContent('train-ticket.png');
    expect(list).toHaveTextContent('69 B · Ada Lovelace · 10/10/2026 11:00');
    expect(within(receipts).getByText(/It has the receipt it needs\./)).toBeInTheDocument();
    expect(within(receipts).getByRole('list', { name: 'Accepted file types' })).toHaveTextContent('PDF');
    expect(within(receipts).getByText(/Max file size: 10 MB/)).toBeInTheDocument();
  });

  it('fetches an image with the token, shows it from a blob URL and releases the URL', async () => {
    tokenStore.set('token-abc');
    const user = userEvent.setup();
    const { backend } = setup({ claim: withReceipt() });
    const receipts = await openReceipts(user);

    await waitFor(() => expect(urls.created.length).toBeGreaterThan(0));
    expect(backend.fileRequests).toEqual([{ receiptId: 'r-1', authorization: 'Bearer token-abc' }]);
    await user.click(within(receipts).getByRole('button', { name: 'Preview train-ticket.png' }));
    expect(await within(receipts).findByRole('img', { name: 'train-ticket.png' })).toHaveAttribute(
      'src',
      expect.stringMatching(/^blob:/),
    );
    // The bytes were fetched once and reused.
    expect(backend.fileRequests).toHaveLength(1);
    await user.click(within(receipts).getByRole('button', { name: 'Back to receipts' }));
    await user.click(within(receipts).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(urls.revoked.length).toBeGreaterThan(0));
  });

  it('refuses a file that is too big, empty or of another type before sending anything', async () => {
    const user = userEvent.setup();
    const { backend } = setup({ claim: withReceipt() });
    const receipts = await openReceipts(user);

    chooseReceipts(
      new File([new Uint8Array(10_485_761)], 'big.pdf', { type: 'application/pdf' }),
      new File([], 'empty.png', { type: 'image/png' }),
      new File(['x'], 'notes.docx', { type: 'application/msword' }),
    );

    const uploads = await within(receipts).findByRole('list', { name: 'Uploads' });
    expect(
      within(uploads)
        .getAllByRole('alert')
        .map((alert) => alert.textContent),
    ).toEqual([
      'big.pdf is larger than 10 MB (10.0 MB).',
      'empty.png is empty.',
      'notes.docx is not an accepted type. Use a PDF, JPG or PNG file.',
    ]);
    expect(backend.calls.filter((call) => call.method === 'POST')).toHaveLength(0);
    await user.click(within(uploads).getByRole('button', { name: 'Remove big.pdf' }));
    expect(within(uploads).queryByText('big.pdf')).not.toBeInTheDocument();
  });

  it("shows the API's own message when it refuses a receipt", async () => {
    const user = userEvent.setup();
    setup({ claim: withReceipt() });
    server.use(
      http.post(orgApiPath('/expenses/:lineId/receipts'), () =>
        fail(413, 'FILE_TOO_LARGE', 'The receipt is larger than 10 MB.'),
      ),
    );
    const receipts = await openReceipts(user);
    chooseReceipts(pdfFile('scan.pdf'));

    const uploads = await within(receipts).findByRole('list', { name: 'Uploads' });
    expect(await within(uploads).findByRole('alert')).toHaveTextContent('The receipt is larger than 10 MB.');
  });

  it('shows the progress of an upload, then the file in the list', async () => {
    const user = userEvent.setup();
    const { backend } = setup({ claim: withReceipt() });
    backend.nextUpload = { file_name: 'invoice.pdf', content_type: 'application/pdf', size_bytes: 8 };
    const receipts = await openReceipts(user);

    chooseReceipts(pdfFile('invoice.pdf'));

    const list = await within(receipts).findByRole('list', { name: 'Receipts' });
    await waitFor(() => expect(list).toHaveTextContent('invoice.pdf'));
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(receipts).queryByRole('list', { name: 'Uploads' })).not.toBeInTheDocument();
  });

  it('deletes a receipt after a confirmation that names it', async () => {
    const user = userEvent.setup();
    const { backend } = setup({ claim: withReceipt() });
    const receipts = await openReceipts(user);

    await user.click(within(receipts).getByRole('button', { name: 'Delete train-ticket.png' }));
    const confirm = await dialog('Delete receipt?');
    expect(confirm).toHaveTextContent('train-ticket.png will be removed from this expense. This cannot be undone.');
    await user.click(within(confirm).getByRole('button', { name: 'Delete receipt' }));

    expect(await screen.findByText('train-ticket.png deleted')).toBeInTheDocument();
    expect(await screen.findByText('No receipts yet.')).toBeInTheDocument();
    expect(backend.calls.some((call) => call.method === 'DELETE')).toBe(true);
  });

  it('only lets a locked claim be looked at', async () => {
    const user = userEvent.setup();
    setup({ claim: { ...withReceipt(), status: 'submitted' } });
    const receipts = await openReceipts(user);

    expect(within(receipts).queryByRole('button', { name: /^Delete / })).not.toBeInTheDocument();
    expect(within(receipts).queryByRole('button', { name: 'Choose a receipt' })).not.toBeInTheDocument();
    expect(
      within(receipts).getByText('Receipts can only be added or removed while the claim is a draft or returned.'),
    ).toBeInTheDocument();
  });
});

describe('deciding on a claim', () => {
  const submitted = () =>
    draft({
      status: 'submitted',
      user_id: '0198c1f2-0000-7000-8000-000000000002',
      user_name: 'Ben Carter',
    });

  it('approves it with a note for the claimant', async () => {
    const user = userEvent.setup();
    const { backend } = setup({
      claim: submitted(),
      list: 'approvals',
      permissions: [...STAFF_PERMISSIONS, 'expense.approve'],
      backend: { canDecide: true },
    });
    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    const form = await dialog('Approve this claim?');
    await user.type(within(form).getByLabelText('Note (optional)'), 'Thanks');
    await user.click(within(form).getByRole('button', { name: 'Approve claim' }));

    expect(await screen.findByText('Claim approved')).toBeInTheDocument();
    expect(backend.calls.find((call) => call.path.endsWith('/approve'))?.body).toEqual({ note: 'Thanks' });
    expect(await screen.findByText(/Approved by Ben Carter/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Expense Approvals' })).toBeInTheDocument();
  });

  it('will not return a claim without a reason, and sends the reason when there is one', async () => {
    const user = userEvent.setup();
    const { backend } = setup({
      claim: submitted(),
      list: 'approvals',
      permissions: [...STAFF_PERMISSIONS, 'expense.approve'],
      backend: { canDecide: true },
    });
    await user.click(await screen.findByRole('button', { name: 'Return' }));
    const form = await dialog('Return this claim?');

    await user.click(within(form).getByRole('button', { name: 'Return claim' }));
    expect(
      await within(form).findByText('Say why the claim is returned, so the claimant knows what to change'),
    ).toBeInTheDocument();
    expect(backend.calls.filter((call) => call.path.endsWith('/return'))).toHaveLength(0);

    await user.type(within(form).getByLabelText('Reason'), 'The dates are wrong.');
    await user.click(within(form).getByRole('button', { name: 'Return claim' }));

    expect(await screen.findByText('Claim returned')).toBeInTheDocument();
    expect(backend.calls.find((call) => call.path.endsWith('/return'))?.body).toEqual({
      reason: 'The dates are wrong.',
    });
    expect(await screen.findByText(/Returned by Ben Carter/)).toBeInTheDocument();
    // The reason shows in the banner of the returned claim and in its history.
    expect(screen.getAllByText('The dates are wrong.')).toHaveLength(2);
  });

  it('does not offer to decide on a claim the caller may not decide on', async () => {
    setup({ claim: submitted(), permissions: [...STAFF_PERMISSIONS, 'expense.approve'] });

    await linesTable();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Return' })).not.toBeInTheDocument();
  });
});

describe('correcting an approved claim', () => {
  const approved = () =>
    draft({
      status: 'approved',
      lines: [makeLine({ id: 'l-train', description: 'Train to Leeds', receipt_count: 1, receipts: [makeReceipt()] })],
    });

  it('needs a reason, sends it with what changed and adds it to the history', async () => {
    const user = userEvent.setup();
    const { backend } = setup({
      claim: approved(),
      permissions: OWNER_PERMISSIONS,
      backend: { canManage: true },
    });
    await lineMenu(user, 'Train to Leeds');
    await user.click(screen.getByRole('menuitem', { name: 'Correct' }));
    const form = await dialog('Correct expense');
    expect(form).toHaveTextContent('The claim is approved: the correction needs a reason');

    await user.clear(within(form).getByLabelText('Description'));
    await user.type(within(form).getByLabelText('Description'), 'Train to York');
    await user.click(within(form).getByRole('button', { name: 'Save correction' }));
    expect(await within(form).findByText('Say why you are correcting this expense')).toBeInTheDocument();
    expect(backend.calls.filter((call) => call.method === 'PATCH')).toHaveLength(0);

    await user.type(within(form).getByLabelText('Reason for the correction'), 'Wrong destination');
    await user.click(within(form).getByRole('button', { name: 'Save correction' }));

    expect(await screen.findByText('Expense corrected')).toBeInTheDocument();
    expect(backend.calls.find((call) => call.method === 'PATCH')?.body).toEqual({
      description: 'Train to York',
      reason: 'Wrong destination',
    });
    const history = await screen.findByRole('list', { name: 'History of the claim' });
    await waitFor(() => expect(history).toHaveTextContent('Corrected by Ada Lovelace'));
    expect(history).toHaveTextContent('Wrong destination');
  });

  it('leaves a billed expense alone', async () => {
    const user = userEvent.setup();
    setup({
      claim: draft({
        status: 'approved',
        lines: [makeLine({ id: 'l-train', description: 'Train to Leeds', billing_status: 'billed' })],
      }),
      permissions: OWNER_PERMISSIONS,
      backend: { canManage: true },
    });
    await lineMenu(user, 'Train to Leeds');

    expect(screen.queryByRole('menuitem', { name: 'Correct' })).not.toBeInTheDocument();
    expect(screen.getByText('Billed')).toBeInTheDocument();
  });
});

describe('an unreachable server', () => {
  it('offers a retry when the claim cannot be loaded', async () => {
    const claim = draft();
    let attempts = 0;
    server.use(
      http.get(orgApiPath('/expense-claims/:claimId'), () => {
        attempts += 1;
        return attempts === 1 ? fail(500, 'SERVER_ERROR', 'Something went wrong.') : ok(claim);
      }),
    );
    const user = userEvent.setup();
    renderExpensePage(<ExpenseClaimDetailPage />, {
      permissions: STAFF_PERMISSIONS,
      route: `${EXPENSES}/mine/${claim.id}`,
      path: `${EXPENSES}/mine/:claimId`,
    });

    expect(await screen.findByText('Could not load the claim')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Client visit, Leeds' })).toBeInTheDocument();
  });
});
