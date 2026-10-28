import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath, renderInOrg } from '@/test/renderInOrg';
import { expectRequiredFields } from '@/test/requiredFields';
import { fail, ok, server } from '@/test/server';

import { EngagementFormPanel } from '../components/EngagementFormPanel';
import type { ClientDetail, ClientServiceRead, EngagementJobRun } from '../types';
import { techwave, techwaveDetail } from './fixtures';
import { heading, renderWorkspace } from './renderWorkspace';

const NAME = 'Techwave Innovations Ltd';
const base = techwaveDetail.engagements[0] as ClientServiceRead;

const autoEngagement: ClientServiceRead = {
  ...base,
  frequency: 'monthly',
  start_date: '2026-10-01',
  auto_create_jobs: true,
  job_lead_days: 6,
  next_job_period: {
    period_start: '2026-10-01',
    period_end: '2026-10-31',
    create_on: '2026-09-25',
  },
};

const withEngagement = (engagement: ClientServiceRead): ClientDetail => ({
  ...techwaveDetail,
  engagements: [engagement],
});

describe('EngagementFormPanel: automatic jobs', () => {
  const quiet = () =>
    server.use(
      http.get(orgApiPath('/services'), () => ok([])),
      http.get(orgApiPath('/members'), () => ok([])),
    );
  const open = async (engagement: ClientServiceRead | null) => {
    quiet();
    renderInOrg(
      <EngagementFormPanel
        target={{ clientId: techwave.id, engagement, takenServiceIds: [] }}
        onClose={() => undefined}
      />,
    );
    return screen.findByRole('region');
  };
  const LEAD = 'Create each job N days before its period starts';

  it('shows the lead days only while the switch is on, and then asks for them and the start date', async () => {
    const user = userEvent.setup();
    const dialog = await open(null);
    const toggle = within(dialog).getByRole('switch', { name: 'Create the jobs automatically' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(within(dialog).queryByLabelText(LEAD)).toBeNull();
    expectRequiredFields(dialog, { required: [], optional: ['Start date'] });

    await user.click(toggle);
    expect(within(dialog).getByLabelText(LEAD)).toHaveValue('0');
    expectRequiredFields(dialog, { required: [LEAD, 'Start date'] });

    await user.click(toggle);
    expect(within(dialog).queryByLabelText(LEAD)).toBeNull();
    expectRequiredFields(dialog, { required: [], optional: ['Start date'] });
  });

  it('asks for the start date and a whole number of days before saving', async () => {
    const user = userEvent.setup();
    const dialog = await open(null);
    await user.click(within(dialog).getByRole('switch'));
    // The start date opens on today: empty it to see it asked for.
    fireEvent.change(within(dialog).getByLabelText('Start date'), { target: { value: '' } });
    await user.clear(within(dialog).getByLabelText(LEAD));
    await user.type(within(dialog).getByLabelText(LEAD), '400');
    await user.click(within(dialog).getByRole('button', { name: 'Add service' }));
    expect(
      await within(dialog).findByText('Choose the start date: periods are counted from it'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a whole number of days, 0 to 365')).toBeInTheDocument();
  });

  it('hints at the next job from the form values', async () => {
    const user = userEvent.setup();
    const dialog = await open(null);
    await user.click(within(dialog).getByRole('switch'));
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Frequency' }),
      'Monthly',
    );
    fireEvent.change(within(dialog).getByLabelText('Start date'), {
      target: { value: '2099-10-01' },
    });
    await user.clear(within(dialog).getByLabelText(LEAD));
    await user.type(within(dialog).getByLabelText(LEAD), '6');
    expect(
      within(dialog).getByText('Next job: Oct 2099, created on 25/09/2099'),
    ).toBeInTheDocument();

    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Frequency' }),
      'One-off',
    );
    expect(within(dialog).getByText('One job, for the start date.')).toBeInTheDocument();
  });

  it('creates an engagement with the automation fields', async () => {
    const posted: unknown[] = [];
    const user = userEvent.setup();
    server.use(
      http.get(orgApiPath('/services'), () =>
        ok([
          {
            id: 'svc-1',
            code: 'PAY',
            name: 'Payroll',
            is_active: true,
            default_fee: null,
          },
        ]),
      ),
      http.post(orgApiPath('/clients/:clientId/services'), async ({ request }) => {
        posted.push(await request.json());
        return ok(autoEngagement, { status: 201 });
      }),
    );
    renderInOrg(
      <EngagementFormPanel
        target={{ clientId: techwave.id, engagement: null, takenServiceIds: [] }}
        onClose={() => undefined}
      />,
    );
    const dialog = await screen.findByRole('region', { name: 'Add service' });
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Service' }),
      await within(dialog).findByRole('option', { name: /Payroll/ }),
    );
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Frequency' }),
      'Monthly',
    );
    fireEvent.change(within(dialog).getByLabelText('Start date'), {
      target: { value: '2026-10-01' },
    });
    await user.click(within(dialog).getByRole('switch'));
    await user.clear(within(dialog).getByLabelText(LEAD));
    await user.type(within(dialog).getByLabelText(LEAD), '6');
    await user.click(within(dialog).getByRole('button', { name: 'Add service' }));
    await waitFor(() =>
      expect(posted).toEqual([
        expect.objectContaining({
          service_id: 'svc-1',
          start_date: '2026-10-01',
          auto_create_jobs: true,
          job_lead_days: 6,
        }),
      ]),
    );
  });

  it('sends only the automation fields that changed on an edit', async () => {
    const patched: unknown[] = [];
    const user = userEvent.setup();
    server.use(
      http.patch(orgApiPath('/clients/:clientId/services/:engagementId'), async ({ request }) => {
        patched.push(await request.json());
        return ok(autoEngagement);
      }),
    );
    const dialog = await open(autoEngagement);
    expect(within(dialog).getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    await user.clear(within(dialog).getByLabelText(LEAD));
    await user.type(within(dialog).getByLabelText(LEAD), '10');
    await user.click(within(dialog).getByRole('button', { name: 'Save service' }));
    await waitFor(() => expect(patched).toHaveLength(1));
    expect(patched[0]).toMatchObject({ job_lead_days: 10 });
    expect(patched[0]).not.toHaveProperty('auto_create_jobs');
  });

  it('shows the API refusal of the start date', async () => {
    const user = userEvent.setup();
    server.use(
      http.patch(orgApiPath('/clients/:clientId/services/:engagementId'), () =>
        fail(422, 'VALIDATION_ERROR', 'Invalid request.', {
          details: [{ field: 'start_date', message: 'A start date is needed.' }],
        }),
      ),
    );
    const dialog = await open({ ...base, start_date: '2026-04-01' });
    await user.click(within(dialog).getByRole('switch'));
    await user.click(within(dialog).getByRole('button', { name: 'Save service' }));
    expect(await within(dialog).findByText('A start date is needed.')).toBeInTheDocument();
  });
});

describe('ServicesCard: automatic jobs', () => {
  const caption = `Services of ${NAME}`;
  const runsOf = (runs: EngagementJobRun[]) =>
    http.get(orgApiPath('/clients/:clientId/services/:engagementId/job-runs'), () => ok(runs));

  async function openServices(
    engagement: ClientServiceRead,
    permissions: string[] = OWNER_PERMISSIONS,
    handlers: Parameters<typeof renderWorkspace>[1] extends infer O
      ? O extends { handlers?: infer H }
        ? H
        : never
      : never = [],
  ) {
    renderWorkspace(`/acme/clients/${techwave.id}/settings?section=services`, {
      clients: [withEngagement(engagement)],
      permissions,
      handlers,
    });
    await heading(NAME);
    return within(await screen.findByRole('table', { name: caption }));
  }

  it('shows the badge and the next period', async () => {
    const table = await openServices(autoEngagement);
    expect(table.getByText('Auto jobs')).toBeInTheDocument();
    expect(table.getByText(/Next job: 01\/10\/2026, created on/)).toHaveTextContent(
      'Next job: 01/10/2026, created on 25/09/2026',
    );
  });

  it('has no badge or next period when the automation is off', async () => {
    const table = await openServices(base);
    expect(table.queryByText('Auto jobs')).toBeNull();
    expect(table.queryByText(/Next job/)).toBeNull();
    expect(table.queryByRole('button', { name: /Create this period/ })).toBeNull();
  });

  it('creates the period job now and links to it', async () => {
    const user = userEvent.setup();
    const table = await openServices(autoEngagement, OWNER_PERMISSIONS, [
      http.post(orgApiPath('/clients/:clientId/services/:engagementId/create-job'), () =>
        ok(
          {
            job: { id: 'job-12', number: 'J00012', name: 'Accounts - Oct 2026' },
            period_start: '2026-10-01',
            period_end: '2026-10-31',
          },
          { status: 201 },
        ),
      ),
    ]);
    await user.click(table.getByRole('button', { name: /Create this period/ }));
    expect(await screen.findByText('Job J00012 created')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open job' })).toBeInTheDocument();
  });

  it.each([
    ['ENGAGEMENT_JOB_EXISTS', 'This period already has its job.'],
    ['ENGAGEMENT_NOT_SCHEDULABLE', 'The engagement has no start date.'],
  ])('shows the refusal %s', async (code, message) => {
    const user = userEvent.setup();
    const table = await openServices(autoEngagement, OWNER_PERMISSIONS, [
      http.post(orgApiPath('/clients/:clientId/services/:engagementId/create-job'), () =>
        fail(409, code, message),
      ),
    ]);
    await user.click(table.getByRole('button', { name: /Create this period/ }));
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('hides the create action without client.update and job.create', async () => {
    const withoutJob = OWNER_PERMISSIONS.filter((permission) => permission !== 'job.create');
    const table = await openServices(autoEngagement, withoutJob);
    expect(table.getByText('Auto jobs')).toBeInTheDocument();
    expect(table.queryByRole('button', { name: /Create this period/ })).toBeNull();
  });

  it('hides the create action without client.update', async () => {
    const withoutUpdate = OWNER_PERMISSIONS.filter((permission) => permission !== 'client.update');
    const table = await openServices(autoEngagement, withoutUpdate);
    expect(table.queryByRole('button', { name: /Create this period/ })).toBeNull();
  });

  it('lists the created jobs only once opened, with a deleted job and a failed run', async () => {
    const user = userEvent.setup();
    let asked = 0;
    const table = await openServices(autoEngagement, OWNER_PERMISSIONS, [
      http.get(orgApiPath('/clients/:clientId/services/:engagementId/job-runs'), () => {
        asked += 1;
        return ok([
          {
            period_start: '2026-10-01',
            period_end: '2026-10-31',
            status: 'created',
            error: null,
            job: { id: 'job-12', number: 'J00012', name: 'Accounts - Oct 2026' },
            created_at: '2026-09-25T03:00:00Z',
          },
          {
            period_start: '2026-09-01',
            period_end: '2026-09-30',
            status: 'created',
            error: null,
            job: null,
            created_at: '2026-08-25T03:00:00Z',
          },
          {
            period_start: '2026-08-01',
            period_end: '2026-08-31',
            status: 'failed',
            error: 'No default tasks.',
            job: null,
            created_at: '2026-07-25T03:00:00Z',
          },
        ] satisfies EngagementJobRun[]);
      }),
    ]);
    expect(asked).toBe(0);
    await user.click(table.getByRole('button', { name: /Created jobs of/ }));
    const dialog = await screen.findByRole('dialog');
    const link = await within(dialog).findByRole('link', { name: /J00012/ });
    expect(link).toHaveAttribute('href', '/acme/jobs/job-12');
    expect(within(dialog).getByText('Job deleted')).toBeInTheDocument();
    expect(within(dialog).getByText('Failed: No default tasks.')).toBeInTheDocument();
    expect(asked).toBe(1);
  });

  it('says so when nothing was created yet', async () => {
    const user = userEvent.setup();
    const table = await openServices(autoEngagement, OWNER_PERMISSIONS, [runsOf([])]);
    await user.click(table.getByRole('button', { name: /Created jobs of/ }));
    expect(await screen.findByText(/No job has been created/)).toBeInTheDocument();
  });
});
