import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { contextWith, OWNER_PERMISSIONS, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath, renderInOrg } from '@/test/renderInOrg';
import { ok, server } from '@/test/server';

import { techwave } from './fixtures';
import { jobs, techwaveOverview } from './workspaceFixtures';
import { jobRatesOf, workspaceHandlers } from './workspaceHandlers';
import { JobsTab } from '../workspace/tabs/JobsTab';
import type { ClientJobRates, JobRow } from '../workspace/types';

const NAME = 'Techwave Innovations Ltd';
const CAPTION = `Jobs of ${NAME}`;

// J-0001 is hourly and follows the task rate (£100 an hour); J-0002 has a client rate agreed;
// J-0003 is a fixed fee of £1,500.
const rows: JobRow[] = [
  { ...(jobs[0] as JobRow), billing_basis: 'hourly', fixed_fee: null, service_name: 'Accounts' },
  { ...(jobs[1] as JobRow), billing_basis: 'hourly', fixed_fee: null, hourly_rate: 12000 },
  jobs[2] as JobRow,
];

function rates(): ClientJobRates {
  const base = jobRatesOf(techwave.id, rows);
  return {
    ...base,
    jobs: base.jobs.map((rate) =>
      rate.job_id === rows[0]?.id
        ? { ...rate, source: 'task', task_rate: { low: 10000, high: 10000, rules: 1 } }
        : rate,
    ),
  };
}

function renderTab(permissions = OWNER_PERMISSIONS, onPatch?: (body: unknown) => void) {
  server.use(
    http.patch(orgApiPath('/jobs/:jobId'), async ({ request, params }) => {
      const body = (await request.json()) as { hourly_rate: number | null };
      onPatch?.(body);
      const job = rows.find((row) => row.id === params.jobId);
      return ok({ ...job, hourly_rate: body.hourly_rate });
    }),
    ...workspaceHandlers({ jobs: rows, jobRates: rates() }),
  );
  return renderInOrg(
    <JobsTab clientId={techwave.id} clientName={NAME} overview={techwaveOverview} />,
    { route: `/acme/clients/${techwave.id}/jobs`, context: contextWith(permissions) },
  );
}

const row = (name: RegExp) =>
  within(screen.getByRole('table', { name: CAPTION })).getByRole('row', { name });

describe('JobsTab rates (APT54)', () => {
  it("shows each job's rate and where it comes from", async () => {
    renderTab();
    await screen.findByRole('row', { name: /J-0001/ });
    await waitFor(() => expect(row(/J-0001/)).toHaveTextContent('Task rate £100.00/h'));
    expect(row(/J-0001/)).toHaveTextContent("The service's rate");
    expect(row(/J-0002/)).toHaveTextContent('Client rate £120.00/h');
    expect(row(/J-0002/)).toHaveTextContent('Agreed for this job');
    expect(row(/J-0003/)).toHaveTextContent('Fixed fee £1,500.00');
    // Only hourly jobs have a rate to change.
    expect(
      within(row(/J-0003/)).queryByRole('button', { name: 'Change the rate of J-0003' }),
    ).not.toBeInTheDocument();
  });

  it('agrees a custom client rate for a job, and goes back to the task rate', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    renderTab(OWNER_PERMISSIONS, (body) => bodies.push(body));
    await screen.findByRole('row', { name: /J-0001/ });

    await user.click(screen.getByRole('button', { name: 'Change the rate of J-0001' }));
    const panel = await screen.findByRole('region', { name: 'Rate for J-0001' });
    expect(within(panel).getByRole('radio', { name: /Use the task rate/ })).toBeChecked();
    expect(panel).toHaveTextContent('Task rate £100.00/h: the rate set against Accounts.');
    await user.click(within(panel).getByRole('radio', { name: /Agree a custom client rate/ }));
    await user.click(within(panel).getByRole('button', { name: 'Save rate' }));
    expect(await within(panel).findByText(/Enter an hourly rate/)).toBeInTheDocument();
    await user.type(within(panel).getByLabelText(/Client rate per hour/), '120');
    // Recorded time keeps its rate: the panel offers to re-rate the job's unbilled time.
    expect(within(panel).getByRole('link', { name: 're-rate it' })).toHaveAttribute(
      'href',
      expect.stringContaining(`/acme/team/re-rate?job_id=${rows[0]?.id ?? ''}`),
    );
    await user.click(within(panel).getByRole('button', { name: 'Save rate' }));
    await waitFor(() => expect(bodies).toEqual([{ hourly_rate: 12000 }]));

    await user.click(screen.getByRole('button', { name: 'Change the rate of J-0002' }));
    const second = await screen.findByRole('region', { name: 'Rate for J-0002' });
    expect(within(second).getByLabelText(/Client rate per hour/)).toHaveValue('120.00');
    await user.click(within(second).getByRole('radio', { name: /Use the task rate/ }));
    await user.click(within(second).getByRole('button', { name: 'Save rate' }));
    await waitFor(() => expect(bodies).toEqual([{ hourly_rate: 12000 }, { hourly_rate: null }]));
  });

  it('shows the rates but no way to change them without job.update', async () => {
    renderTab(STAFF_PERMISSIONS);
    await screen.findByRole('row', { name: /J-0002/ });
    await waitFor(() => expect(row(/J-0002/)).toHaveTextContent('Client rate £120.00/h'));
    expect(screen.queryByRole('button', { name: /Change the rate/ })).not.toBeInTheDocument();
  });
});
