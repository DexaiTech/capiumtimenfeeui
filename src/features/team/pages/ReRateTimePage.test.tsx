import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { contextWith } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { fail, ok, server } from '@/test/server';

import { acme, job, preview, rerun, rerunItem, sam, testReruns } from '../test/fixtures';
import { orgApiPath, teamHandlers } from '../test/handlers';
import type { ReratePreview } from '../types';
import ReRateTimePage from './ReRateTimePage';

type User = ReturnType<typeof userEvent.setup>;

/** jsdom matches no media query (the card layout); this renders the md-and-up tables. */
function desktop() {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string): MediaQueryList => ({
    matches: query.includes('min-width'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

const MANAGER = ['rate.manage', 'client.read', 'job.read', 'member.read'];

interface Calls {
  previews: unknown[];
  applies: unknown[];
}

/** The preview and apply endpoints, recording what they are sent. */
function rerateHandlers(
  calls: Calls,
  options: { preview?: ReratePreview; apply?: () => Response | Promise<Response> } = {},
) {
  return [
    http.post(orgApiPath('/rates/rerate/preview'), async ({ request }) => {
      calls.previews.push(await request.json());
      return ok(options.preview ?? preview);
    }),
    http.post(orgApiPath('/rates/rerate'), async ({ request }) => {
      calls.applies.push(await request.json());
      return options.apply ? options.apply() : ok(rerun, { status: 201 });
    }),
  ];
}

const newCalls = (): Calls => ({ previews: [], applies: [] });

const setDate = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

async function addClient(user: User, name = /Acme Ltd/) {
  await user.click(screen.getByRole('combobox', { name: 'Add a client' }));
  await user.click(await screen.findByRole('option', { name }));
}

/** A scope of one client and September, previewed. */
async function previewSeptember(user: User) {
  await addClient(user);
  setDate('From', '2026-09-01');
  setDate('To', '2026-09-30');
  await user.click(screen.getByRole('button', { name: 'Preview re-rate' }));
  return screen.findByRole('heading', { level: 2, name: 'Preview' });
}

function renderPage(options: Parameters<typeof renderInOrg>[1] = {}) {
  return renderInOrg(<ReRateTimePage />, options);
}

beforeEach(() => {
  desktop();
  server.use(...teamHandlers());
});

describe('ReRateTimePage scope', () => {
  it('starts with the scope form only: no preview, nothing to apply', async () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Re-rate Time' })).toBeInTheDocument();
    expect(screen.getByText('1. Choose the time to re-rate')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Preview' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply re-rate' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview re-rate' })).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Earlier re-rates' }),
    ).toBeInTheDocument();
  });

  it('asks for clients, jobs or a date range before previewing anything', async () => {
    const calls = newCalls();
    server.use(...rerateHandlers(calls));
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Preview re-rate' }));
    expect(await screen.findByText('Choose clients, jobs or a date range')).toBeInTheDocument();

    setDate('From', '2026-09-01');
    await user.click(screen.getByRole('button', { name: 'Preview re-rate' }));
    expect(
      await screen.findByText('Enter both dates of the range, or leave both empty'),
    ).toBeInTheDocument();

    setDate('To', '2026-08-01');
    await user.click(screen.getByRole('button', { name: 'Preview re-rate' }));
    expect(
      await screen.findByText("The end date can't be before the start date"),
    ).toBeInTheDocument();
    expect(calls.previews).toHaveLength(0);
  });

  it('previews a date range on its own, with nothing else in the scope', async () => {
    const calls = newCalls();
    server.use(...rerateHandlers(calls));
    const user = userEvent.setup();
    renderPage();

    setDate('From', '2026-09-01');
    setDate('To', '2026-09-30');
    await user.click(screen.getByRole('button', { name: 'Preview re-rate' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Preview' })).toBeInTheDocument();
    expect(calls.previews).toEqual([
      {
        scope: {
          client_ids: [],
          job_ids: [],
          user_ids: [],
          date_from: '2026-09-01',
          date_to: '2026-09-30',
        },
      },
    ]);
  });

  it('builds the scope from chips of clients, jobs and staff and sends exactly that', async () => {
    const calls = newCalls();
    server.use(...rerateHandlers(calls));
    const user = userEvent.setup();
    renderPage();

    await addClient(user);
    // The same client twice is still one chip.
    await addClient(user);
    expect(
      within(screen.getByRole('list', { name: 'Chosen clients' })).getAllByRole('listitem'),
    ).toHaveLength(1);

    await user.click(screen.getByRole('combobox', { name: 'Add a job' }));
    await user.click(await screen.findByRole('option', { name: /J00002 · Year-end accounts/ }));
    await user.click(screen.getByRole('combobox', { name: 'Add a staff member' }));
    await user.click(await screen.findByRole('option', { name: /Sam Staff/ }));
    setDate('From', '2026-09-01');
    setDate('To', '2026-09-30');
    await user.click(
      screen.getByRole('checkbox', { name: /Also list the entries that would not change/ }),
    );
    await user.click(screen.getByRole('button', { name: 'Preview re-rate' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Preview' })).toBeInTheDocument();
    expect(calls.previews).toEqual([
      {
        scope: {
          client_ids: [acme.id],
          job_ids: [job.id],
          user_ids: [sam.id],
          date_from: '2026-09-01',
          date_to: '2026-09-30',
        },
        include_unchanged: true,
      },
    ]);
  });

  it('removes a chip, and Clear empties the whole form', async () => {
    const user = userEvent.setup();
    renderPage();

    await addClient(user);
    await user.click(screen.getByRole('combobox', { name: 'Add a staff member' }));
    await user.click(await screen.findByRole('option', { name: /Sam Staff/ }));
    setDate('From', '2026-09-01');
    await user.click(screen.getByRole('button', { name: 'Remove Acme Ltd' }));
    expect(screen.queryByRole('list', { name: 'Chosen clients' })).not.toBeInTheDocument();
    expect(screen.getByText('All clients.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByRole('list', { name: 'Chosen staff' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('From')).toHaveValue('');
  });

  it('only offers the pickers the permissions allow', () => {
    renderPage({ context: contextWith(['rate.manage']) });
    expect(screen.queryByRole('combobox', { name: 'Add a client' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Add a job' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Add a staff member' })).not.toBeInTheDocument();
    // The date range always works.
    expect(screen.getByLabelText('From')).toBeInTheDocument();
  });

  it('explains missing access without asking anything when there is no rate.manage', () => {
    let asked = 0;
    server.use(
      http.get(orgApiPath('/rates/reruns'), () => {
        asked += 1;
        return ok([], { meta: { next_cursor: null, has_more: false } });
      }),
    );
    renderPage({ context: contextWith(['rate.read', 'member.read']) });
    expect(screen.getByText("You don't have access to this page")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Preview re-rate' })).not.toBeInTheDocument();
    expect(asked).toBe(0);
  });
});

describe('ReRateTimePage preview', () => {
  it('shows what would happen: the totals, what is left alone and why, and every entry', async () => {
    const calls = newCalls();
    server.use(...rerateHandlers(calls));
    const user = userEvent.setup();
    renderPage();

    await previewSeptember(user);
    expect(screen.getByText(/Nothing has been changed yet/)).toBeInTheDocument();
    expect(screen.getByText('Preview ready: 1 entry would change.')).toBeInTheDocument();

    const stat = (label: string) =>
      screen.getByText(label, { selector: 'dt' }).parentElement as HTMLElement;
    expect(within(stat('Entries to change')).getByText('1')).toBeInTheDocument();
    expect(
      within(stat('Entries to change')).getByText('of 1 unbilled entry looked at'),
    ).toBeInTheDocument();
    expect(within(stat('Left alone')).getByText('3')).toBeInTheDocument();
    expect(
      within(stat('Left alone')).getByText(
        'Already billed 1 · On a draft invoice 1 · In a locked period 1',
      ),
    ).toBeInTheDocument();
    expect(within(stat('Charge-out value')).getByText('£145.00')).toBeInTheDocument();
    expect(within(stat('Charge-out value')).getByText('Was £60.00 (+£85.00)')).toBeInTheDocument();
    expect(within(stat('Cost value')).getByText('Was £10.00 (£0.00)')).toBeInTheDocument();

    const table = within(screen.getByRole('table', { name: 'Entries in the preview' }));
    const change = within(table.getAllByRole('row')[1] as HTMLElement);
    expect(change.getByText('07/09/2026')).toBeInTheDocument();
    expect(change.getByText('Sam Staff')).toBeInTheDocument();
    expect(change.getByText('Acme Ltd')).toBeInTheDocument();
    expect(change.getByText('Year-end accounts')).toBeInTheDocument();
    expect(change.getByText('1:00')).toBeInTheDocument();
    expect(change.getByText('£60.00/h → £145.00/h')).toBeInTheDocument();
    expect(change.getByText('£60.00 → £145.00')).toBeInTheDocument();
    expect(change.getByText('Will change')).toBeInTheDocument();
    // A locked entry says why it is left alone, and shows the rates it keeps: not the ones it
    // would have had.
    const locked = within(table.getAllByRole('row')[2] as HTMLElement);
    expect(locked.getByText('Left alone · In a locked period')).toBeInTheDocument();
    expect(locked.getByText('£60.00/h')).toBeInTheDocument();
    expect(locked.queryByText(/→/)).not.toBeInTheDocument();
  });

  it('cannot apply until there is a preview, and not when nothing would change', async () => {
    const calls = newCalls();
    const nothing: ReratePreview = {
      ...preview,
      totals: {
        ...preview.totals,
        entries_to_change: 0,
        charge_value_after: 6000,
        charge_value_delta: 0,
      },
      items: [],
    };
    server.use(...rerateHandlers(calls, { preview: nothing }));
    const user = userEvent.setup();
    renderPage();
    expect(screen.queryByRole('button', { name: 'Apply re-rate' })).not.toBeInTheDocument();

    await previewSeptember(user);
    expect(screen.getByRole('button', { name: 'Apply re-rate' })).toBeDisabled();
    expect(screen.getByText('No entries would change')).toBeInTheDocument();
  });

  it('says when the list of entries is shorter than the totals', async () => {
    server.use(...rerateHandlers(newCalls(), { preview: { ...preview, items_truncated: true } }));
    const user = userEvent.setup();
    renderPage();
    await previewSeptember(user);
    expect(
      screen.getByText(/Showing the first 2 entries\. The totals above cover all 1 unbilled entry/),
    ).toBeInTheDocument();
  });

  it('hides the cost without rate.read', async () => {
    server.use(...rerateHandlers(newCalls()));
    const user = userEvent.setup();
    renderPage({ context: contextWith(MANAGER) });
    await previewSeptember(user);

    expect(screen.queryByText('Cost value')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Cost rate' })).not.toBeInTheDocument();
    // Nor the history, which needs rate.read.
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Earlier re-rates' }),
    ).not.toBeInTheDocument();
  });

  it('throws the preview away when the scope changes, so it cannot be applied by mistake', async () => {
    server.use(...rerateHandlers(newCalls()));
    const user = userEvent.setup();
    renderPage();
    await previewSeptember(user);
    expect(screen.getByRole('button', { name: 'Apply re-rate' })).toBeEnabled();

    setDate('To', '2026-10-31');
    await waitFor(() =>
      expect(screen.queryByRole('heading', { level: 2, name: 'Preview' })).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: 'Apply re-rate' })).not.toBeInTheDocument();
  });

  it('explains a refused preview on the form', async () => {
    server.use(
      http.post(orgApiPath('/rates/rerate/preview'), () =>
        fail(
          422,
          'VALIDATION_ERROR',
          'More than 20,000 unbilled entries are in scope. Narrow the scope.',
          {
            details: [{ field: 'scope', code: 'scope_too_large', message: 'Too many entries.' }],
          },
        ),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await addClient(user);
    await user.click(screen.getByRole('button', { name: 'Preview re-rate' }));
    expect(
      await screen.findByText(/More than 20,000 unbilled entries are in scope/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Preview' })).not.toBeInTheDocument();
  });
});

describe('ReRateTimePage apply', () => {
  it('applies the previewed result after confirmation, with a note, and shows the outcome', async () => {
    const calls = newCalls();
    let listed = 0;
    server.use(
      ...rerateHandlers(calls),
      http.get(orgApiPath('/rates/reruns'), () => {
        listed += 1;
        return ok(testReruns, { meta: { next_cursor: null, has_more: false } });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await previewSeptember(user);
    await waitFor(() => expect(listed).toBe(1));

    await user.click(screen.getByRole('button', { name: 'Apply re-rate' }));
    const dialog = await screen.findByRole('dialog', { name: 'Apply the re-rate?' });
    // Nothing is sent before the confirmation, which says what will happen.
    expect(calls.applies).toHaveLength(0);
    expect(within(dialog).getByText('1 unbilled entry')).toBeInTheDocument();
    expect(within(dialog).getByText(/£60\.00 to\s+£145\.00 \(\+£85\.00\)/)).toBeInTheDocument();
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Note (optional)' }),
      'September correction',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Apply re-rate' }));

    expect(await screen.findByText('Re-rate applied')).toBeInTheDocument();
    // The same scope the preview was made from, with its token.
    expect(calls.applies).toEqual([
      { scope: preview.scope, preview_token: preview.preview_token, note: 'September correction' },
    ]);
    const outcome = screen.getByRole('status', { name: 'Re-rate applied' });
    expect(
      within(outcome).getByText(
        '1 entry updated, 3 left alone (Already billed 1 · On a draft invoice 1 · In a locked period 1).',
      ),
    ).toBeInTheDocument();
    expect(within(outcome).getByText(/£60\.00 → £145\.00 \(\+£85\.00\)/)).toBeInTheDocument();
    // The preview is used up; the history is asked for again.
    expect(screen.queryByRole('heading', { level: 2, name: 'Preview' })).not.toBeInTheDocument();
    await waitFor(() => expect(listed).toBeGreaterThan(1));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Apply the re-rate?' })).not.toBeInTheDocument(),
    );
  });

  it('sends no note when none is written', async () => {
    const calls = newCalls();
    server.use(...rerateHandlers(calls));
    const user = userEvent.setup();
    renderPage();
    await previewSeptember(user);

    await user.click(screen.getByRole('button', { name: 'Apply re-rate' }));
    const dialog = await screen.findByRole('dialog', { name: 'Apply the re-rate?' });
    await user.click(within(dialog).getByRole('button', { name: 'Apply re-rate' }));

    expect(await screen.findByText('Re-rate applied')).toBeInTheDocument();
    expect(calls.applies).toEqual([{ scope: preview.scope, preview_token: preview.preview_token }]);
  });

  it('keeps the preview when the confirmation is cancelled', async () => {
    const calls = newCalls();
    server.use(...rerateHandlers(calls));
    const user = userEvent.setup();
    renderPage();
    await previewSeptember(user);

    await user.click(screen.getByRole('button', { name: 'Apply re-rate' }));
    const dialog = await screen.findByRole('dialog', { name: 'Apply the re-rate?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Apply the re-rate?' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Preview' })).toBeInTheDocument();
    expect(calls.applies).toHaveLength(0);
  });

  it('says so when the preview has gone stale, cannot be confirmed again, and asks for a new one', async () => {
    const calls = newCalls();
    server.use(
      ...rerateHandlers(calls, {
        apply: () =>
          fail(409, 'PREVIEW_STALE', 'Rates or time changed since the preview.', {
            details: { entries_to_change: 2, charge_value_after: 15000 },
          }),
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await previewSeptember(user);

    await user.click(screen.getByRole('button', { name: 'Apply re-rate' }));
    const dialog = await screen.findByRole('dialog', { name: 'Apply the re-rate?' });
    await user.click(within(dialog).getByRole('button', { name: 'Apply re-rate' }));

    expect(
      await within(dialog).findByText(
        'Rates or time changed since the preview. It would now change 2 entries, to a charge-out value of £150.00. Close this and preview again.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Apply re-rate' })).toBeDisabled();
    expect(calls.applies).toHaveLength(1);

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    // The old preview is gone: it has to be made again.
    await waitFor(() =>
      expect(screen.queryByRole('heading', { level: 2, name: 'Preview' })).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: 'Apply re-rate' })).not.toBeInTheDocument();
  });

  it('keeps the dialog open with any other refusal, and lets it be tried again', async () => {
    let attempt = 0;
    server.use(
      ...rerateHandlers(newCalls(), {
        apply: () => {
          attempt += 1;
          return attempt === 1
            ? fail(403, 'PERMISSION_DENIED', 'You need the rate.manage permission.')
            : ok(rerun, { status: 201 });
        },
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await previewSeptember(user);

    await user.click(screen.getByRole('button', { name: 'Apply re-rate' }));
    const dialog = await screen.findByRole('dialog', { name: 'Apply the re-rate?' });
    await user.click(within(dialog).getByRole('button', { name: 'Apply re-rate' }));
    expect(
      await within(dialog).findByText('You need the rate.manage permission.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Apply re-rate' })).toBeEnabled();

    await user.click(within(dialog).getByRole('button', { name: 'Apply re-rate' }));
    expect(await screen.findByText('Re-rate applied')).toBeInTheDocument();
  });
});

describe('ReRateTimePage history', () => {
  it('lists the earlier re-rates, newest first, with who, what, the scope and the value', async () => {
    renderPage();

    // The table is there while the runs load; wait for the first of them.
    await screen.findByText('17/10/2026 22:23');
    const table = screen.getByRole('table', { name: 'Earlier re-rates' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);

    // 21:23 UTC on 17 October is 22:23 in London.
    const latest = within(rows[0] as HTMLElement);
    expect(latest.getByText('17/10/2026 22:23')).toBeInTheDocument();
    expect(latest.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(latest.getByText('Re-rate')).toBeInTheDocument();
    expect(latest.getByText('1 client · 01/09/2026 – 30/09/2026')).toBeInTheDocument();
    expect(latest.getByText('1 changed · 3 left alone')).toBeInTheDocument();
    expect(latest.getByText('£60.00 → £145.00 (+£85.00)')).toBeInTheDocument();
    expect(latest.getByText('September correction')).toBeInTheDocument();

    // A V1 re-valuation, which lowered the value and has no note.
    const older = within(rows[1] as HTMLElement);
    expect(older.getByText('10/10/2026 10:00')).toBeInTheDocument();
    expect(older.getByText('Re-valuation (V1)')).toBeInTheDocument();
    expect(older.getByText('01/08/2026 – 31/08/2026')).toBeInTheDocument();
    expect(older.getByText('£200.00 → £190.00 (−£10.00)')).toBeInTheDocument();
  });

  it('opens a run to the entries it changed and filters them by what happened', async () => {
    const outcomes: Array<string | null> = [];
    server.use(
      http.get(orgApiPath('/rates/reruns/:runId/items'), ({ request, params }) => {
        const outcome = new URL(request.url).searchParams.get('outcome');
        outcomes.push(`${String(params.runId)}:${outcome}`);
        return ok(outcome === 'skipped' ? [] : [rerunItem], {
          meta: { next_cursor: null, has_more: false },
        });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole('button', { name: 'Entries of the re-rate of 17/10/2026 22:23' }),
    );
    const entries = await screen.findByRole('table', { name: 'Entries of the re-rate' });
    const entry = within(within(entries).getAllByRole('row')[1] as HTMLElement);
    expect(entry.getByText('07/09/2026')).toBeInTheDocument();
    expect(entry.getByText('£60.00/h → £145.00/h')).toBeInTheDocument();
    expect(entry.getByText('Changed')).toBeInTheDocument();
    expect(outcomes).toEqual([`${rerun.id}:null`]);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Show' }), 'Left alone');
    await waitFor(() => expect(outcomes.at(-1)).toBe(`${rerun.id}:skipped`));
    expect(
      await screen.findByText('This re-rate has no entries of that kind.'),
    ).toBeInTheDocument();
  });

  it('shows the empty state, and the error state with a retry', async () => {
    const user = userEvent.setup();
    server.use(...teamHandlers({ reruns: [] }));
    const first = renderPage();
    expect(await screen.findByText('No re-rates yet')).toBeInTheDocument();
    first.unmount();

    let fails = true;
    server.use(
      http.get(orgApiPath('/rates/reruns'), () =>
        fails
          ? fail(500, 'INTERNAL_ERROR', 'Boom.')
          : ok([rerun], { meta: { next_cursor: null, has_more: false } }),
      ),
    );
    renderPage();
    expect(await screen.findByText('Could not load the earlier re-rates')).toBeInTheDocument();
    fails = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('17/10/2026 22:23')).toBeInTheDocument();
  });
});
