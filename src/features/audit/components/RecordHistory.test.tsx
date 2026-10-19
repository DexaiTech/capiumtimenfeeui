import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { orgApiPath, renderInOrg } from '@/test/renderInOrg';
import { fail, server } from '@/test/server';

import { CLIENT_ID, createdEntry, historyEntry } from '../test/fixtures';
import { historyHandlers, historyPath } from '../test/handlers';
import { RecordHistory } from './RecordHistory';

const renderHistory = (props: Partial<Parameters<typeof RecordHistory>[0]> = {}) =>
  renderInOrg(<RecordHistory targetType="client" targetId={CLIENT_ID} {...props} />);

describe('RecordHistory', () => {
  it('shows a timeline, newest first, with who, what, when and the before and after', async () => {
    server.use(
      ...historyHandlers({ first: { rows: [historyEntry(), createdEntry()], next: null } }),
    );
    renderHistory();

    const list = await screen.findByRole('list', { name: 'History entries' });
    const [updated, created] = within(list).getAllByRole('listitem') as [HTMLElement, HTMLElement];

    // Who and what, with the record it is about.
    expect(within(updated).getByText('Client details updated')).toBeInTheDocument();
    expect(within(updated).getByRole('img', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(within(updated).getByText('Ada Lovelace')).toBeVisible();
    expect(within(updated).getByText(/C00012 · Acme Group/)).toBeInTheDocument();

    // When: relative inline, exact in the practice's time zone (BST in October).
    const time = within(updated).getByText((_, element) => element?.tagName === 'TIME');
    expect(time).toHaveAttribute('datetime', '2026-10-05T09:14:07Z');
    expect(within(updated).getByText('· 05/10/2026 10:14')).toBeInTheDocument();

    // The field-level before and after.
    const table = within(updated).getByRole('table', {
      name: 'Changes made on 05/10/2026 10:14',
    });
    const row = within(table).getByRole('row', { name: /Name/ });
    expect(within(row).getByRole('rowheader', { name: 'Name' })).toBeInTheDocument();
    expect(within(row).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      'Acme Ltd',
      'Acme Group',
    ]);
    expect(within(updated).getByText('203.0.113.7')).toBeInTheDocument();

    // A creation has nothing to compare.
    expect(within(created).getByText('Client created')).toBeInTheDocument();
    expect(within(created).queryByRole('table')).toBeNull();

    expect(screen.getByText('Showing 2 entries · Start of the history')).toBeInTheDocument();
  });

  it('asks for the record, a page of 25 and, for a client, what names it', async () => {
    const requests: URLSearchParams[] = [];
    server.use(...historyHandlers({ first: { rows: [historyEntry()], next: null } }, requests));
    const view = renderHistory();
    await screen.findByText('Client details updated');
    expect(requests[0]?.get('target_type')).toBe('client');
    expect(requests[0]?.get('target_id')).toBe(CLIENT_ID);
    expect(requests[0]?.get('limit')).toBe('25');
    expect(requests[0]?.get('cursor')).toBeNull();
    expect(requests[0]?.has('include_related')).toBe(false);
    view.unmount();

    renderHistory({ includeRelated: true, title: 'Client history' });
    expect(await screen.findByRole('heading', { name: 'Client history' })).toBeInTheDocument();
    await waitFor(() => expect(requests.length).toBe(2));
    expect(requests[1]?.get('include_related')).toBe('true');
  });

  it('leaves the address out when the API sends none, and names the system when nobody acted', async () => {
    server.use(
      ...historyHandlers({
        first: {
          rows: [
            historyEntry({
              id: 'system',
              actor: null,
              ip_address: null,
              label: 'Timesheet reminders sent',
              summary: 'Timesheet reminders sent',
              changes: [],
            }),
          ],
          next: null,
        },
      }),
    );
    renderHistory();

    const [item] = (await screen.findAllByRole('listitem')) as [HTMLElement];
    expect(within(item).getByRole('img', { name: 'System' })).toBeInTheDocument();
    expect(within(item).getByText('System')).toBeInTheDocument();
    expect(within(item).queryByText(/IP address/)).toBeNull();
  });

  it('writes dates the UK way and says "None" for a value that was not there', async () => {
    server.use(
      ...historyHandlers({
        first: {
          rows: [
            historyEntry({
              action: 'period_lock.locked',
              label: 'Period locked',
              summary: 'Period locked',
              changes: [
                { field: 'locked_through', before: null, after: '2026-03-31' },
                { field: 'is_default', before: false, after: true },
                { field: 'assignee_user_ids', before: ['a', 'b'], after: [] },
              ],
            }),
          ],
          next: null,
        },
      }),
    );
    renderHistory();

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    const cells = rows.map((row) => [
      within(row).getByRole('rowheader').textContent,
      ...within(row).getAllByRole('cell').map((cell) => cell.textContent),
    ]);
    expect(cells).toEqual([
      ['Locked through', 'None', '31/03/2026'],
      ['Is default', 'No', 'Yes'],
      ['Assignee user ids', 'a, b', 'None'],
    ]);
  });

  it('loads older entries with the cursor of the page before', async () => {
    const requests: URLSearchParams[] = [];
    server.use(
      ...historyHandlers(
        {
          first: { rows: [historyEntry()], next: 'cursor-2' },
          'cursor-2': { rows: [createdEntry()], next: null },
        },
        requests,
      ),
    );
    const user = userEvent.setup();
    renderHistory();

    await screen.findByText('Client details updated');
    expect(screen.getByText('Showing 1 entry')).toBeInTheDocument();
    expect(screen.queryByText('Client created')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Load older entries' }));

    expect(await screen.findByText('Client created')).toBeInTheDocument();
    expect(requests.map((params) => params.get('cursor'))).toEqual([null, 'cursor-2']);
    expect(screen.getByText('Showing 2 entries · Start of the history')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load older entries' })).toBeNull();
  });

  it('says there is no history yet', async () => {
    server.use(...historyHandlers({ first: { rows: [], next: null } }));
    renderHistory();
    expect(await screen.findByText('No history yet')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'History entries' })).toBeNull();
  });

  it('shows a skeleton while it loads', async () => {
    server.use(...historyHandlers({ first: { rows: [historyEntry()], next: null } }));
    renderHistory();
    expect(screen.getByRole('status', { name: 'Loading the history' })).toBeInTheDocument();
    await screen.findByText('Client details updated');
    expect(screen.queryByRole('status', { name: 'Loading the history' })).toBeNull();
  });

  it('shows a failure and tries again', async () => {
    server.use(http.get(historyPath(), () => fail(500, 'INTERNAL_ERROR', 'Boom')));
    const user = userEvent.setup();
    renderHistory();

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Could not load the history')).toBeInTheDocument();
    expect(within(alert).getByText(/Request ID/)).toBeInTheDocument();

    server.use(...historyHandlers({ first: { rows: [historyEntry()], next: null } }));
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Client details updated')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the API\u2019s refusal when the role may not read this history', async () => {
    server.use(
      http.get(orgApiPath('/audit-logs/history'), () =>
        fail(403, 'PERMISSION_DENIED', 'You do not have permission to do that.'),
      ),
    );
    renderHistory();
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('You do not have permission to do that.')).toBeInTheDocument();
  });
});
