import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { fail, ok, server } from '@/test/server';

import { apt15, apt16, detailOf, emptyDashboard, testDashboard } from '../test/fixtures';
import { gate, orgApiPath, ticketHandlers } from '../test/handlers';
import TicketsDashboardPage from './TicketsDashboardPage';

// Recharts has no size under jsdom: the implementations of the chart kit are replaced by plain
// text of what the page handed them. The legends, tables and cards around them are the real ones.
vi.mock('@/components/charts/impl/DonutChartImpl', () => ({
  default: ({ centreLabel }: { centreLabel?: { value: string; label: string } }) => (
    <p data-testid="donut">{centreLabel ? `${centreLabel.value} ${centreLabel.label}` : ''}</p>
  ),
}));
vi.mock('@/components/charts/impl/BarChartImpl', () => ({
  default: (props: {
    data: Array<Record<string, unknown>>;
    colorKey?: string;
    valueLabels?: boolean;
  }) => (
    <p data-testid="bars">
      {props.data
        .map(
          (row) => `${String(row.priority)}:${String(props.colorKey ? row[props.colorKey] : '')}`,
        )
        .join(',')}
      {` labels:${String(props.valueLabels)}`}
    </p>
  ),
}));
vi.mock('@/components/charts/impl/LineChartImpl', () => ({
  default: (props: { data: unknown[]; series: Array<{ key: string }> }) => (
    <p data-testid="lines">
      {props.series.map((entry) => entry.key).join(',')} over {props.data.length} days
    </p>
  ),
}));

const ROUTE = '/acme/application-testing/dashboard';

function renderDashboard(permissions: string[] = OWNER_PERMISSIONS) {
  return renderInOrg(<TicketsDashboardPage />, {
    context: contextWith(permissions),
    route: ROUTE,
  });
}

const card = (name: string) => screen.getByRole('region', { name });

const itemTexts = (container: HTMLElement) =>
  within(container)
    .getAllByRole('listitem')
    .map((item) => item.textContent);

async function loaded() {
  return screen.findByRole('button', { name: '01-Sep-2026 · 30-Sep-2026' });
}

describe('TicketsDashboardPage', () => {
  it('shows the title and the range the API used', async () => {
    server.use(...ticketHandlers());
    renderDashboard();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Application Testing Dashboard' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Overview of bugs, enhancements and issue status')).toBeInTheDocument();
    expect(await loaded()).toBeInTheDocument();
  });

  it('shows the six cards with their numbers and how each moved against the last period', async () => {
    server.use(...ticketHandlers());
    renderDashboard();
    const totals = await screen.findByRole('list', { name: 'Ticket totals' });
    await within(totals).findByText('16');

    const items = within(totals).getAllByRole('listitem');
    expect(items).toHaveLength(6);
    expect(items[0]).toHaveTextContent('16Total TicketsUp60% vs last period');
    expect(items[1]).toHaveTextContent('6OpenUp50% vs last period');
    // Nothing before: "New", not a percentage of zero.
    expect(items[2]).toHaveTextContent('2HoldUpNew vs last period');
    expect(items[3]).toHaveTextContent('3In ProgressUp0% vs last period');
    // A fall: a red down arrow and the size of the fall (the sign is the arrow and the word).
    expect(items[4]).toHaveTextContent('1ReopenDown50% vs last period');
    expect(within(items[4] as HTMLElement).getByText(/vs last period/)).toHaveClass('text-danger');
    expect(items[5]).toHaveTextContent('4ClosedUp300% vs last period');
    expect(within(items[5] as HTMLElement).getByText(/vs last period/)).toHaveClass('text-success');
  });

  it('draws the status ring with the total in the middle and a legend of count and share', async () => {
    server.use(...ticketHandlers());
    renderDashboard();
    await loaded();

    const status = card('Tickets by Status');
    expect(await within(status).findByTestId('donut')).toHaveTextContent('16 Total');
    expect(itemTexts(within(status).getByRole('list', { name: 'Legend' }))).toEqual([
      'Open6 (37.5%)',
      'Hold2 (12.5%)',
      'In Progress3 (18.8%)',
      'Reopen1 (6.3%)',
      'Closed4 (25.0%)',
    ]);
  });

  it('draws one bar per priority, each in its own colour with its count above it', async () => {
    const user = userEvent.setup();
    server.use(...ticketHandlers());
    renderDashboard();
    await loaded();

    const priority = card('Tickets by Priority');
    expect(await within(priority).findByTestId('bars')).toHaveTextContent(
      'High:danger,Medium:orange,Low:success,Not Set:muted labels:true',
    );
    await user.click(within(priority).getByRole('button', { name: 'View as table' }));
    const rows = within(within(priority).getByRole('table')).getAllByRole('row');
    expect(rows.map((row) => row.textContent)).toEqual([
      'PriorityTickets',
      'High4',
      'Medium4',
      'Low3',
      'Not Set5',
    ]);
  });

  it('ranks the tags with "Others" last and the assignees with "Unassigned" among them', async () => {
    server.use(...ticketHandlers());
    renderDashboard();
    await loaded();

    expect(
      itemTexts(within(card('Tickets by Tag')).getByRole('list', { name: 'Tickets by Tag' })),
    ).toEqual([
      'Bug6',
      'Reporting3',
      'Accounts2',
      'Docs2',
      'Enhancement2',
      'Security2',
      'UI2',
      'Others1',
    ]);
    expect(
      itemTexts(
        within(card('Top Assignees (by Ticket Count)')).getByRole('list', {
          name: 'Top Assignees (by Ticket Count)',
        }),
      ),
    ).toEqual(['Unassigned5', 'Alice Adams4', 'Bob Brown4', 'Carol Clark3']);
  });

  it('draws a line per status over the last 14 days and offers the figures as a table', async () => {
    const user = userEvent.setup();
    server.use(...ticketHandlers());
    renderDashboard();
    await loaded();

    const trend = card('Status Trend (Last 14 Days)');
    expect(await within(trend).findByTestId('lines')).toHaveTextContent(
      'open,hold,in_progress,reopen,closed over 14 days',
    );
    expect(itemTexts(within(trend).getByRole('list', { name: 'Legend' }))).toEqual([
      'Open',
      'Hold',
      'In Progress',
      'Reopen',
      'Closed',
    ]);
    await user.click(within(trend).getByRole('button', { name: 'View as table' }));
    const grid = within(trend).getByRole('table');
    expect(
      within(grid)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Date', 'Open', 'Hold', 'In Progress', 'Reopen', 'Closed']);
    expect(within(grid).getAllByRole('row')).toHaveLength(15);
  });

  it("lists the recent tickets with their code, pills, tags and the practice's calendar day", async () => {
    server.use(...ticketHandlers());
    renderDashboard();
    await loaded();

    const recent = card('Recent Tickets');
    expect(within(recent).getByRole('link', { name: 'View All' })).toHaveAttribute(
      'href',
      '/acme/application-testing/tickets',
    );
    const table = within(recent).getByRole('table', { name: 'Recent tickets' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Ticket No.', 'Subject', 'Status', 'Priority', 'Tags', 'Created on']);

    const [, first, second] = within(table).getAllByRole('row');
    expect(within(first as HTMLElement).getByRole('link', { name: 'APT16' })).toHaveAttribute(
      'href',
      `/acme/application-testing/tickets/${apt16.id}`,
    );
    expect(first).toHaveTextContent('September 16');
    expect(first).toHaveTextContent('Closed');
    expect(first).toHaveTextContent('Not Set');
    expect(first).toHaveTextContent('Security');
    expect(first).toHaveTextContent('30-Sep-2026');
    expect(second).toHaveTextContent('APT15');
    expect(second).toHaveTextContent('BugReporting');
    // 23:30 UTC on 29 September is already the 30th in London.
    expect(second).toHaveTextContent('30-Sep-2026');
  });

  it('asks for the range that was chosen and shows the one the API answers with', async () => {
    const user = userEvent.setup();
    const asked: URLSearchParams[] = [];
    server.use(
      ...ticketHandlers({
        onDashboard: (params) => asked.push(params),
        dashboard: (params) => ({
          ...testDashboard,
          date_from: params.get('date_from') ?? testDashboard.date_from,
          date_to: params.get('date_to') ?? testDashboard.date_to,
        }),
      }),
    );
    renderDashboard();

    // Without a choice nothing is sent: the API's own last 19 days.
    await user.click(await loaded());
    expect(asked[0]?.has('date_from')).toBe(false);
    expect(asked[0]?.has('date_to')).toBe(false);

    const dialog = screen.getByRole('dialog', { name: 'Choose the dates' });
    expect(within(dialog).getByLabelText('From')).toHaveValue('2026-09-01');
    fireEvent.change(within(dialog).getByLabelText('From'), { target: { value: '2026-08-01' } });
    fireEvent.change(within(dialog).getByLabelText('To'), { target: { value: '2026-08-31' } });
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(asked.at(-1)?.get('date_from')).toBe('2026-08-01'));
    expect(asked.at(-1)?.get('date_to')).toBe('2026-08-31');
    expect(
      await screen.findByRole('button', { name: '01-Aug-2026 · 31-Aug-2026' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Choose the dates' })).not.toBeInTheDocument(),
    );
  });

  it('refuses a range the API would refuse, and says why', async () => {
    const user = userEvent.setup();
    server.use(...ticketHandlers());
    renderDashboard();
    await user.click(await loaded());
    const dialog = screen.getByRole('dialog', { name: 'Choose the dates' });
    const apply = within(dialog).getByRole('button', { name: 'Apply' });

    fireEvent.change(within(dialog).getByLabelText('From'), { target: { value: '2026-10-05' } });
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'The start date must be on or before the end date.',
    );
    expect(apply).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText('From'), { target: { value: '2024-01-01' } });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Choose at most 366 days.');
    expect(apply).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText('From'), { target: { value: '2026-09-15' } });
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    expect(apply).toBeEnabled();
  });

  it('puts a quick range into the fields', async () => {
    const user = userEvent.setup();
    server.use(...ticketHandlers());
    renderDashboard();
    await user.click(await loaded());
    const dialog = screen.getByRole('dialog', { name: 'Choose the dates' });

    const last7 = within(dialog).getByRole('button', { name: 'Last 7 days' });
    expect(last7).toHaveAttribute('aria-pressed', 'false');
    await user.click(last7);
    expect(last7).toHaveAttribute('aria-pressed', 'true');
    expect(within(dialog).getByLabelText('From')).not.toHaveValue('2026-09-01');
  });

  it('changes the status of a recent ticket at once and keeps it when the API accepts it', async () => {
    const user = userEvent.setup();
    let current = apt15;
    const pending = gate();
    const bodies: unknown[] = [];
    server.use(
      ...ticketHandlers({ dashboard: () => ({ ...testDashboard, recent: [apt16, current] }) }),
      http.patch(orgApiPath('/tickets/:ticketId'), async ({ request }) => {
        bodies.push(await request.json());
        await pending.promise;
        current = { ...apt15, status: 'hold' };
        return ok(detailOf(current));
      }),
    );
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: 'Status of APT15: Open' }));
    await user.click(screen.getByRole('option', { name: 'Hold' }));

    // At once: the pill already says Hold while the request is still on its way.
    expect(
      await screen.findByRole('button', { name: 'Status of APT15: Hold' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(bodies).toEqual([{ status: 'hold' }]));
    pending.open();
    expect(await screen.findByText('Status of APT15 set to Hold')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Status of APT15: Hold' })).toBeInTheDocument();
  });

  it('puts the status back and says why when the API refuses the change', async () => {
    const user = userEvent.setup();
    server.use(
      ...ticketHandlers(),
      http.patch(orgApiPath('/tickets/:ticketId'), () =>
        fail(422, 'VALIDATION_ERROR', 'That status is not allowed.'),
      ),
    );
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: 'Status of APT15: Open' }));
    await user.click(screen.getByRole('option', { name: 'Hold' }));

    expect(await screen.findByText('Could not change APT15')).toBeInTheDocument();
    expect(screen.getByText('That status is not allowed.')).toBeInTheDocument();
    // The sentence a screen reader hears too.
    expect(
      screen.getByText('Could not change APT15. The change to APT15 was undone.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Status of APT15: Open' })).toBeInTheDocument();
  });

  it('changes the priority of a recent ticket', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(
      ...ticketHandlers(),
      http.patch(orgApiPath('/tickets/:ticketId'), async ({ request }) => {
        bodies.push(await request.json());
        return ok(detailOf({ ...apt16, priority: 'high' }));
      }),
    );
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: 'Priority of APT16: Not Set' }));
    await user.click(screen.getByRole('option', { name: 'High' }));

    expect(await screen.findByText('Priority of APT16 set to High')).toBeInTheDocument();
    expect(bodies).toEqual([{ priority: 'high' }]);
  });

  it('says so in every card when the range holds no ticket', async () => {
    server.use(...ticketHandlers({ dashboard: emptyDashboard }));
    renderDashboard();
    const totals = await screen.findByRole('list', { name: 'Ticket totals' });
    await screen.findByRole('button', { name: '01-Jan-2026 · 19-Jan-2026' });

    for (const item of within(totals).getAllByRole('listitem')) {
      expect(item).toHaveTextContent('0');
      expect(item).toHaveTextContent('Up0% vs last period');
    }
    // The ring, the priority bars, the trend and the assignees; the tags have their own words.
    expect(screen.getAllByText('No tickets in this period')).toHaveLength(4);
    expect(screen.getByText('No tags in this period')).toBeInTheDocument();
    expect(screen.getByText('No tickets in this period.')).toBeInTheDocument();
    expect(screen.queryByTestId('donut')).not.toBeInTheDocument();
  });

  it('shows the error with a retry, and the dashboard once the retry works', async () => {
    const user = userEvent.setup();
    let failing = true;
    // The first handler that matches answers: the override goes before the defaults.
    server.use(
      http.get(orgApiPath('/tickets/dashboard'), () =>
        failing ? fail(500, 'INTERNAL_ERROR', 'Boom.') : ok(testDashboard),
      ),
      ...ticketHandlers(),
    );
    renderDashboard();

    expect(await screen.findByText('Could not load the dashboard')).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await loaded()).toBeInTheDocument();
    expect(screen.queryByText('Could not load the dashboard')).not.toBeInTheDocument();
  });

  it('shows the pills as plain text to a role that may only read', async () => {
    server.use(...ticketHandlers());
    renderDashboard(['ticket.read']);
    await loaded();

    const table = within(card('Recent Tickets')).getByRole('table', { name: 'Recent tickets' });
    expect(within(table).getByText('Closed')).toBeInTheDocument();
    expect(within(table).getByText('Not Set')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Status of / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Priority of / })).not.toBeInTheDocument();
  });

  it('tells a role without ticket.read that the page is not included', () => {
    renderDashboard(['client.read']);
    expect(screen.getByText("You don't have access to this page")).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Ticket totals' })).not.toBeInTheDocument();
  });
});
