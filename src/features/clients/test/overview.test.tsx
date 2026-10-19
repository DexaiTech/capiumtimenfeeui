import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath } from '@/test/renderInOrg';
import { fail, ok } from '@/test/server';

import { techwave, techwaveDetail } from './fixtures';
import { renderWorkspace, heading, SERVER_PROBLEM } from './renderWorkspace';
import { emptyOverview, staffOverview, techwaveOverview } from './workspaceFixtures';

const OVERVIEW = `/acme/clients/${techwave.id}/overview`;
const NAME = 'Techwave Innovations Ltd';

const keyFigures = () => within(screen.getByRole('list', { name: 'Key figures' }));
/** The `dd` of a financial snapshot line, by its `dt`. */
const stat = (label: string) => {
  const term = screen.getByText(label, { selector: 'dt' });
  if (!term.nextElementSibling) throw new Error(`No figure for ${label}`);
  return term.nextElementSibling;
};

describe('OverviewTab', () => {
  it('shows the key figures as money and hours, each linking to its tab', async () => {
    renderWorkspace(OVERVIEW);
    await heading(NAME);
    await screen.findByRole('list', { name: 'Key figures' });

    const jobs = keyFigures().getByRole('link', { name: /Active jobs/ });
    expect(jobs).toHaveTextContent('2');
    expect(jobs).toHaveTextContent('1 in progress · 3 in total');
    expect(jobs).toHaveAttribute('href', `/acme/clients/${techwave.id}/jobs`);

    const hours = keyFigures().getByRole('link', { name: /Billable hours, last 30 days/ });
    expect(hours).toHaveTextContent('12:30');
    expect(hours).toHaveTextContent('of 16:00 logged');
    expect(hours).toHaveAttribute('href', `/acme/clients/${techwave.id}/time`);

    const wip = keyFigures().getByRole('link', { name: /Work in progress/ });
    expect(wip).toHaveTextContent('£1,250.00');
    expect(wip).toHaveTextContent('5 items not yet billed');
    expect(wip).toHaveAttribute('href', `/acme/clients/${techwave.id}/wip`);

    const outstanding = keyFigures().getByRole('link', { name: /Outstanding/ });
    expect(outstanding).toHaveTextContent('£1,200.00');
    expect(outstanding).toHaveTextContent('£300.00 overdue');
    expect(outstanding).toHaveAttribute('href', `/acme/clients/${techwave.id}/invoices`);

    const billed = keyFigures().getByRole('link', { name: /Billed this year/ });
    expect(billed).toHaveTextContent('£8,000.00');
    expect(billed).toHaveTextContent('Net of VAT, since 01/01/2026');

    const payments = keyFigures().getByRole('link', { name: /Payments received this year/ });
    expect(payments).toHaveTextContent('£6,000.00');
    expect(payments).toHaveTextContent('3 payments since 01/01/2026');
    expect(payments).toHaveAttribute('href', `/acme/clients/${techwave.id}/payments`);
  });

  it('draws the WIP ageing bars', async () => {
    renderWorkspace(OVERVIEW);
    const ageing = await screen.findByRole('list', { name: 'WIP ageing' });
    expect(
      within(ageing)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      '0–30 days£600.00',
      '31–60 days£400.00',
      '61–90 days£150.00',
      'Over 90 days£100.00',
    ]);
  });

  it('lists the recent activity: what, who and when, and the central service as the actor', async () => {
    renderWorkspace(OVERVIEW);
    const activity = await screen.findByRole('list', { name: 'Recent activity' });
    const [issued, central] = within(activity).getAllByRole('listitem');
    expect(issued).toHaveTextContent('Invoice issued');
    expect(issued).toHaveTextContent(/Grace Hopper · 10\/06\/2026/);
    expect(central).toHaveTextContent('Details confirmed by the central service');
    expect(central).toHaveTextContent(/Capium central · 01\/06\/2026/);
  });

  it('keeps the identifiers, the address, the practice, the notes and the money snapshot', async () => {
    renderWorkspace(OVERVIEW);
    await heading(NAME);

    const identifiers = within(await screen.findByRole('region', { name: 'Identifiers' }));
    expect(identifiers.getByText('APX006')).toBeInTheDocument();
    expect(identifiers.getByText('678654QJ')).toBeInTheDocument();
    expect(identifiers.getByText('Limited')).toBeInTheDocument();

    const contact = within(screen.getByRole('region', { name: 'Contact and address' }));
    expect(contact.getByText('accounts@techwave.example')).toBeInTheDocument();
    expect(contact.getByText('Ramya Menon')).toBeInTheDocument();
    expect(contact.getByText(/1 High Street/)).toHaveTextContent('London');

    const practice = within(screen.getByRole('region', { name: 'Practice' }));
    expect(practice.getByText('31 March')).toBeInTheDocument();
    expect(await practice.findByText('Grace Hopper')).toBeInTheDocument();
    expect(practice.getByText('30 days')).toBeInTheDocument();

    expect(
      within(screen.getByRole('region', { name: 'Notes' })).getByText('Prefers email.'),
    ).toBeInTheDocument();

    expect(stat('WIP')).toHaveTextContent('£1,259.56');
    expect(stat('WIP time')).toHaveTextContent('£1,234.56');
    expect(stat('WIP disbursements')).toHaveTextContent('£25.00');
    expect(stat('Unbilled time')).toHaveTextContent('2h 30m');
    expect(stat('Outstanding')).toHaveTextContent('£500.00');
    expect(stat('Overdue')).toHaveTextContent('£19.99');
    // A role without the figure sees a dash, not a zero.
    expect(stat('On account')).toHaveTextContent('—');
    expect(stat('Recurring fees (net / yr)')).toHaveTextContent('£1,500.00');
    expect(stat('Gross / yr')).toHaveTextContent('£1,800.00');
  });

  it('shows no card for a section the role may not see', async () => {
    renderWorkspace(OVERVIEW, { permissions: STAFF_PERMISSIONS, overview: staffOverview });
    await screen.findByRole('list', { name: 'Key figures' });

    const figures = keyFigures();
    expect(figures.getByRole('link', { name: /Active jobs/ })).toBeInTheDocument();
    // Time is the caller's own.
    expect(figures.getByRole('link', { name: /Billable hours, last 30 days/ })).toHaveTextContent(
      '(your own time)',
    );
    expect(figures.queryByRole('link', { name: /Work in progress/ })).toBeNull();
    expect(figures.queryByRole('link', { name: /Outstanding/ })).toBeNull();
    expect(figures.queryByRole('link', { name: /Billed this year/ })).toBeNull();
    expect(figures.queryByRole('link', { name: /Payments received/ })).toBeNull();
    // No WIP: no ageing either.
    expect(screen.queryByRole('list', { name: 'WIP ageing' })).toBeNull();
    // The activity is still there.
    expect(screen.getByRole('list', { name: 'Recent activity' })).toBeInTheDocument();
  });

  it('shows no figures at all when every section is hidden, but still the panels', async () => {
    renderWorkspace(OVERVIEW, { overview: emptyOverview });
    expect(await screen.findByText('No recent activity')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Key figures' })).toBeNull();
    expect(screen.queryByRole('list', { name: 'WIP ageing' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Identifiers' })).toBeInTheDocument();
    expect(screen.queryByText('Could not load the key figures')).toBeNull();
  });

  it('shows a skeleton while the key figures load', async () => {
    renderWorkspace(OVERVIEW, {
      handlers: [
        http.get(orgApiPath('/clients/:clientId/overview'), async () => {
          await delay(300);
          return ok(techwaveOverview);
        }),
      ],
    });
    await heading(NAME);
    expect(screen.getByRole('status', { name: 'Loading the key figures' })).toBeInTheDocument();
    expect(await screen.findByRole('list', { name: 'Key figures' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading the key figures' })).toBeNull();
  });

  it('explains a failed load of the figures, retries, and keeps the panels', async () => {
    let calls = 0;
    const user = userEvent.setup();
    renderWorkspace(OVERVIEW, {
      handlers: [
        http.get(orgApiPath('/clients/:clientId/overview'), () => {
          calls += 1;
          return calls === 1 ? fail(500, 'INTERNAL_ERROR', 'Boom.') : ok(techwaveOverview);
        }),
      ],
    });

    expect(await screen.findByText('Could not load the key figures')).toBeInTheDocument();
    expect(screen.getByText(SERVER_PROBLEM)).toBeInTheDocument();
    // The client itself loaded: its panels are there, without the tab badges.
    expect(screen.getByRole('region', { name: 'Identifiers' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Jobs' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('list', { name: 'Key figures' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /^Jobs\s*3$/ })).toBeInTheDocument(),
    );
  });

  it('leaves out the empty details of a client that has few', async () => {
    renderWorkspace(OVERVIEW, {
      clients: [{ ...techwaveDetail, notes: null, email: null, address_line1: null }],
    });
    await heading(NAME);
    const notes = within(await screen.findByRole('region', { name: 'Notes' }));
    // A missing note is a dash, never "null".
    expect(notes.getAllByText('—')).toHaveLength(2);
    expect(screen.queryByText('null')).toBeNull();
  });
});
