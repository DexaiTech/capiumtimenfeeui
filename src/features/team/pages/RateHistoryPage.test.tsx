import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { contextWith } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { fail, ok, server } from '@/test/server';

import { accounts, acme, changeCreated, sam, seniorGrade } from '../test/fixtures';
import { orgApiPath, page, teamHandlers } from '../test/handlers';
import type { RateChange } from '../types';
import RateHistoryPage from './RateHistoryPage';

const row = (name: RegExp) => screen.findByRole('row', { name });

function renderPage(options: Parameters<typeof renderInOrg>[1] = {}) {
  return renderInOrg(<RateHistoryPage />, options);
}

const READ_ONLY = ['rate.read'];

beforeEach(() => {
  server.use(...teamHandlers());
});

describe('RateHistoryPage', () => {
  it('lists every change with when, who, what, what it applies to, the rate and the period', async () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Rate History' })).toBeInTheDocument();
    // Shown in the practice's zone: 14:30 UTC is 15:30 in London in October.
    const created = within(await row(/05\/10\/2026 15:30/));
    expect(created.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(created.getByText('Created')).toBeInTheDocument();
    expect(created.getByText('Charge-out · Staff')).toBeInTheDocument();
    expect(created.getByText('Sam Staff')).toBeInTheDocument();
    expect(created.getByText('£175.00/h')).toBeInTheDocument();
    expect(created.getByText('01/03/2026 – open-ended')).toBeInTheDocument();
    expect(created.getByText('Rates')).toBeInTheDocument();

    // An end-date changes the period, not the rate.
    const ended = within(await row(/06\/10\/2026 11:00/));
    expect(ended.getByText('End-dated')).toBeInTheDocument();
    expect(ended.getByText('Charge-out · Client + service')).toBeInTheDocument();
    expect(ended.getByText('Acme Ltd · Year-end accounts')).toBeInTheDocument();
    expect(ended.getByText('£200.00/h')).toBeInTheDocument();
    expect(
      ended.getByText('01/06/2026 – open-ended → 01/06/2026 – 31/12/2026'),
    ).toBeInTheDocument();

    // The default rate of a grade has no period, and the amount moved.
    const grade = within(await row(/07\/10\/2026 09:15/));
    expect(grade.getByText('Changed')).toBeInTheDocument();
    expect(grade.getByText('Cost · Grade')).toBeInTheDocument();
    expect(grade.getByText('Senior grade')).toBeInTheDocument();
    expect(grade.getByText('£30.00/h → £32.00/h')).toBeInTheDocument();
    expect(grade.getAllByText('Grade default')).toHaveLength(2);

    expect(screen.getByText('Showing 3 changes · End of the list')).toBeInTheDocument();
  });

  it('shows what was removed and what a deletion left', async () => {
    const deleted: RateChange = {
      ...changeCreated,
      id: 'change-4',
      at: '2026-10-08T12:00:00Z',
      action: 'deleted',
      old: changeCreated.new,
      new: null,
      actor_name: null,
      source: 'staff_rates',
    };
    server.use(...teamHandlers({ changes: [deleted] }));
    renderPage();

    const entry = within(await row(/08\/10\/2026 13:00/));
    expect(entry.getByText('Deleted')).toBeInTheDocument();
    expect(entry.getByText('£175.00/h')).toBeInTheDocument();
    expect(entry.getByText('01/03/2026 – open-ended')).toBeInTheDocument();
    // No name for a change made by the system, and the V1 endpoints are named as such.
    expect(entry.getByText('—')).toBeInTheDocument();
    expect(entry.getByText('Staff rates (V1)')).toBeInTheDocument();
  });

  it('shows a skeleton while loading', () => {
    server.use(http.get(orgApiPath('/rates/history'), () => new Promise(() => undefined)));
    renderPage();
    expect(document.querySelector('table[aria-busy="true"]')).not.toBeNull();
  });

  it('narrows by kind, type of change, staff member, grade, client, service and dates', async () => {
    const queries: URLSearchParams[] = [];
    server.use(...teamHandlers({ onHistory: (params) => queries.push(params) }));
    const user = userEvent.setup();
    renderPage();
    await row(/05\/10\/2026/);

    await user.click(screen.getByRole('tab', { name: 'Cost' }));
    await waitFor(() => expect(queries.at(-1)?.get('kind')).toBe('cost'));
    expect(await row(/07\/10\/2026/)).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /05\/10\/2026/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'All changes' }));
    await row(/05\/10\/2026/);
    expect(queries.at(-1)?.has('kind')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Filter' }));
    const panel = await screen.findByRole('dialog', { name: 'Filter rate changes' });
    await user.selectOptions(
      within(panel).getByRole('combobox', { name: 'Type of change' }),
      'End-dated',
    );
    await waitFor(() => expect(queries.at(-1)?.get('action')).toBe('end_dated'));
    expect(await row(/06\/10\/2026 11:00/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /05\/10\/2026/ })).not.toBeInTheDocument(),
    );
    await user.selectOptions(
      within(panel).getByRole('combobox', { name: 'Type of change' }),
      'Any change',
    );
    await waitFor(() => expect(queries.at(-1)?.has('action')).toBe(false));

    await user.click(within(panel).getByRole('combobox', { name: 'Staff member' }));
    await user.click(await within(panel).findByRole('option', { name: /Sam Staff/ }));
    await waitFor(() => expect(queries.at(-1)?.get('user_id')).toBe(sam.id));
    await user.selectOptions(within(panel).getByRole('combobox', { name: 'Grade' }), 'Senior');
    await waitFor(() => expect(queries.at(-1)?.get('grade_id')).toBe(seniorGrade.id));
    await user.click(within(panel).getByRole('combobox', { name: 'Client' }));
    await user.click(await within(panel).findByRole('option', { name: /Acme Ltd/ }));
    await waitFor(() => expect(queries.at(-1)?.get('client_id')).toBe(acme.id));
    await user.selectOptions(
      within(panel).getByRole('combobox', { name: 'Service' }),
      'Year-end accounts',
    );
    await waitFor(() => expect(queries.at(-1)?.get('service_id')).toBe(accounts.id));
    fireEvent.change(within(panel).getByLabelText('Changed on from'), {
      target: { value: '2026-10-01' },
    });
    await waitFor(() => expect(queries.at(-1)?.get('date_from')).toBe('2026-10-01'));
    fireEvent.change(within(panel).getByLabelText('Changed on to'), {
      target: { value: '2026-10-31' },
    });
    await waitFor(() => expect(queries.at(-1)?.get('date_to')).toBe('2026-10-31'));
    expect(screen.getByRole('button', { name: /Filter, 6 filters applied/ })).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(queries.at(-1)?.has('user_id')).toBe(false));
    for (const name of ['grade_id', 'client_id', 'service_id', 'date_from', 'date_to', 'action']) {
      expect(queries.at(-1)?.has(name)).toBe(false);
    }
  });

  it('opens already narrowed when linked from a rate list', async () => {
    const queries: URLSearchParams[] = [];
    server.use(...teamHandlers({ onHistory: (params) => queries.push(params) }));
    renderPage({ route: `/?kind=cost&grade=${seniorGrade.id}` });

    expect(await row(/07\/10\/2026/)).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /05\/10\/2026/ })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Cost' })).toHaveAttribute('aria-selected', 'true');
    expect(queries[0]?.get('kind')).toBe('cost');
    expect(queries[0]?.get('grade_id')).toBe(seniorGrade.id);
    // The kind is the tab; the grade is the one filter applied.
    expect(screen.getByRole('button', { name: /Filter, 1 filters applied/ })).toBeInTheDocument();
  });

  it('loads the next page with the cursor', async () => {
    const cursors: Array<string | null> = [];
    const many: RateChange[] = Array.from({ length: 3 }, (_, index) => ({
      ...changeCreated,
      id: `change-${index}`,
      at: `2026-10-0${index + 1}T09:00:00Z`,
      actor_name: `Person ${index}`,
    }));
    server.use(
      http.get(orgApiPath('/rates/history'), ({ request }) => {
        const params = new URL(request.url).searchParams;
        cursors.push(params.get('cursor'));
        const result = page(many, params, 2);
        return ok(result.rows, { meta: result.meta });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await row(/Person 0/);
    expect(screen.getByText('Showing 2 changes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await row(/Person 2/)).toBeInTheDocument();
    expect(cursors).toEqual([null, '2']);
    expect(screen.getByText('Showing 3 changes · End of the list')).toBeInTheDocument();
  });

  it('hides and shows columns', async () => {
    const user = userEvent.setup();
    renderPage();
    await row(/05\/10\/2026/);

    expect(screen.getByRole('columnheader', { name: 'Source' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show/Hide Columns' }));
    await user.click(screen.getByRole('checkbox', { name: 'Source' }));
    expect(screen.queryByRole('columnheader', { name: 'Source' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'When' })).toBeDisabled();
  });

  it('exports the loaded changes as a CSV file', async () => {
    const created: Blob[] = [];
    // jsdom has no object URLs; the stand-ins are removed again in `finally`.
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: (blob: Blob) => {
        created.push(blob);
        return 'blob:history';
      },
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: () => undefined,
    });
    try {
      const user = userEvent.setup();
      renderPage();
      await row(/05\/10\/2026/);

      await user.click(screen.getByRole('button', { name: 'Export' }));
      expect(created).toHaveLength(1);
      const blob = created[0] as Blob;
      expect(blob.type).toBe('text/csv;charset=utf-8');
      const text = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.readAsText(blob);
      });
      expect(text).toContain('When,Who,Change,Kind,Level,Applies to,Rate,Period,Source');
      expect(text).toContain(
        '05/10/2026 15:30,Ada Lovelace,Created,Charge-out,Staff,Sam Staff,£175.00/h,01/03/2026 – open-ended,Rates',
      );
    } finally {
      Reflect.deleteProperty(URL, 'createObjectURL');
      Reflect.deleteProperty(URL, 'revokeObjectURL');
    }
  });

  it('shows the empty state, the no-match state and the error state with a retry', async () => {
    const user = userEvent.setup();
    server.use(...teamHandlers({ changes: [] }));
    const first = renderPage();
    expect(await screen.findByText('No rate changes yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
    await user.click(screen.getByRole('tab', { name: 'Cost' }));
    expect(await screen.findByText('No changes match')).toBeInTheDocument();
    first.unmount();

    let fails = true;
    server.use(
      http.get(orgApiPath('/rates/history'), () =>
        fails
          ? fail(500, 'INTERNAL_ERROR', 'Boom.')
          : ok([changeCreated], { meta: { next_cursor: null, has_more: false } }),
      ),
    );
    renderPage();
    expect(await screen.findByText('Could not load the rate history')).toBeInTheDocument();
    fails = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await row(/05\/10\/2026/)).toBeInTheDocument();
  });

  it('explains missing access without asking for the history when there is no rate.read', () => {
    let asked = 0;
    server.use(
      http.get(orgApiPath('/rates/history'), () => {
        asked += 1;
        return ok([], { meta: { next_cursor: null, has_more: false } });
      }),
    );
    renderPage({ context: contextWith(['member.read', 'rate.manage']) });
    expect(screen.getByText("You don't have access to this page")).toBeInTheDocument();
    expect(asked).toBe(0);
  });

  it('offers only the filters the permissions allow', async () => {
    const user = userEvent.setup();
    renderPage({ context: contextWith(READ_ONLY) });
    await row(/05\/10\/2026/);

    await user.click(screen.getByRole('button', { name: 'Filter' }));
    const panel = await screen.findByRole('dialog', { name: 'Filter rate changes' });
    expect(within(panel).queryByRole('combobox', { name: 'Staff member' })).not.toBeInTheDocument();
    expect(within(panel).queryByRole('combobox', { name: 'Grade' })).not.toBeInTheDocument();
    expect(within(panel).queryByRole('combobox', { name: 'Client' })).not.toBeInTheDocument();
    expect(within(panel).getByRole('combobox', { name: 'Type of change' })).toBeInTheDocument();
    expect(within(panel).getByRole('combobox', { name: 'Service' })).toBeInTheDocument();
    expect(within(panel).getByLabelText('Changed on from')).toBeInTheDocument();
  });
});
