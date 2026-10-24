import { Calculator } from 'lucide-react';
import { useId, useState, type SyntheticEvent } from 'react';

import { Button, Card, CardHeader, EmptyState, Input, Select, Skeleton } from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle, useUrlParams } from '@/hooks';
import { formatUkDate, todayInZone } from '@/utils/dates';

import { useRateResolution, useServices } from '../api';
import { LoadError, NoAccess, PageShell } from '../components/PageShell';
import { ClientPicker } from '../components/pickers/ClientPicker';
import { JobPicker } from '../components/pickers/JobPicker';
import { StaffPicker } from '../components/pickers/StaffPicker';
import { RateLadder } from '../components/rates/RateLadder';
import type { LadderStep, RateResolution, ResolveQuery } from '../types';
import { formatRate } from '../utils/format';
import { stepPeriod } from '../utils/ladder';

const WHICH = 'The rate a person would get is worked out from the rates in force on that day.';

/** One of the two answers: the rate, what it came from and the period of the rate behind it. */
function Answer({
  title,
  step,
  rate,
}: {
  title: string;
  step: LadderStep | undefined;
  rate: number | null;
}) {
  return (
    <Card padding="sm" className="flex min-w-0 flex-col gap-1">
      <h3 className="text-sm font-medium text-text-muted">{title}</h3>
      <p className="text-3xl font-bold tracking-tight text-text tabular-nums">{formatRate(rate)}</p>
      <p className="text-sm text-text">
        {step?.label ?? '—'}
        {stepPeriod(step) ? <span className="text-text-muted"> · {stepPeriod(step)}</span> : null}
      </p>
    </Card>
  );
}

/** What the question was, in words: "Sam Staff (Senior) on 15/10/2026, for Acme Ltd · Year-end accounts". */
function describe(resolution: RateResolution): string {
  const grade = resolution.grade ? ` (${resolution.grade.name})` : '';
  const what = [resolution.client?.name, resolution.service?.name].filter(Boolean).join(' · ');
  const job = resolution.job_id ? 'the chosen job' : '';
  const context = [what, job].filter(Boolean).join(', ');
  return `${resolution.staff.full_name}${grade} on ${formatUkDate(resolution.on_date)}${context ? `, for ${context}` : ''}`;
}

function Result({ resolution }: { resolution: RateResolution }) {
  const charge = resolution.charge_ladder.find((step) => step.selected);
  const cost = resolution.cost_ladder.find((step) => step.selected);
  return (
    <section aria-labelledby="rate-result" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h2 id="rate-result" className="text-base font-semibold text-text">
          Rate for {describe(resolution)}
        </h2>
        <p className="text-sm text-text-muted">
          Nothing is saved: this is only the answer to the question.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Answer title="Charge-out rate" step={charge} rate={resolution.charge_rate} />
        <Answer title="Cost rate" step={cost} rate={resolution.cost_rate} />
      </div>
      <Card padding="none">
        <CardHeader
          title="How the charge-out rate was chosen"
          description="The first level that has a rate in force wins; the rest are shown for comparison."
        />
        <RateLadder caption="Charge-out rate levels" steps={resolution.charge_ladder} numbered />
      </Card>
      <Card padding="none">
        <CardHeader
          title="How the cost rate was chosen"
          description="The person's own cost rate, else their grade's, else none."
        />
        <RateLadder caption="Cost rate levels" steps={resolution.cost_ladder} />
      </Card>
    </section>
  );
}

function RatePreview() {
  const { organization, can } = useOrg();
  const { params, setParam } = useUrlParams();
  const formId = useId();
  const today = todayInZone(organization.timezone);
  const canPickStaff = can(PERMISSIONS.memberRead);
  const canPickClient = can(PERMISSIONS.clientRead);
  const canPickJob = can(PERMISSIONS.jobRead);

  // The question asked lives in the URL, so an answer can be shared and survives a reload.
  const asked = params.get('staff');
  const query: ResolveQuery | null = asked
    ? {
        user_id: asked,
        date: params.get('date') || today,
        client_id: params.get('client') || undefined,
        job_id: params.get('job') || undefined,
        service_id: params.get('service') || undefined,
      }
    : null;
  const resolution = useRateResolution(query);
  const services = useServices();

  const [staffId, setStaffId] = useState(params.get('staff') ?? '');
  const [clientId, setClientId] = useState(params.get('client') ?? '');
  const [clientName, setClientName] = useState<string | undefined>(undefined);
  const [jobId, setJobId] = useState(params.get('job') ?? '');
  const [serviceId, setServiceId] = useState(params.get('service') ?? '');
  const [date, setDate] = useState(params.get('date') ?? today);
  const [missing, setMissing] = useState<string | null>(null);

  const serviceOptions = [
    { value: '', label: 'No service' },
    ...(services.data ?? [])
      .filter((service) => service.is_active)
      .map((service) => ({ value: service.id, label: service.name })),
  ];

  const onSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!staffId) {
      setMissing('Choose a staff member');
      return;
    }
    setMissing(null);
    const next = {
      staff: staffId,
      client: clientId,
      job: jobId,
      service: serviceId,
      date: date || today,
    };
    const same =
      query !== null &&
      query.user_id === staffId &&
      (query.client_id ?? '') === clientId &&
      (query.job_id ?? '') === jobId &&
      (query.service_id ?? '') === serviceId &&
      query.date === next.date;
    // The same question again is asked again: the rates may have changed since.
    if (same) void resolution.refetch();
    else setParam(next);
  };

  const reset = () => {
    setStaffId('');
    setClientId('');
    setClientName(undefined);
    setJobId('');
    setServiceId('');
    setDate(today);
    setMissing(null);
    setParam({ staff: null, client: null, job: null, service: null, date: null });
  };

  return (
    <>
      <Card padding="none">
        <CardHeader title="What rate would this person get?" description={WHICH} />
        <form id={formId} noValidate onSubmit={onSubmit} className="grid gap-4 p-5 md:grid-cols-2">
          {canPickStaff ? (
            <StaffPicker
              label="Staff member"
              required
              value={staffId || null}
              onChange={(id) => {
                setStaffId(id ?? '');
                setMissing(null);
              }}
              includeLeft
              error={missing ?? undefined}
            />
          ) : (
            <p className="rounded-md border border-border bg-surface-sunken px-3 py-2.5 text-sm text-text-muted md:col-span-2">
              You need permission to view staff to choose who the rate is for.
            </p>
          )}
          <Input
            label="Date"
            type="date"
            hint="The rates in force on this day. Defaults to today."
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          {canPickClient ? (
            <ClientPicker
              label="Client"
              value={clientId || null}
              valueLabel={clientName}
              onChange={(id, item) => {
                setClientId(id ?? '');
                setClientName(item?.label);
                // A job belongs to one client: another client means another job.
                setJobId('');
              }}
              placeholder="Any client"
              hint="Optional."
            />
          ) : null}
          {canPickJob ? (
            <JobPicker
              label="Job"
              value={jobId || null}
              clientId={clientId || null}
              onChange={(job) => {
                setJobId(job?.id ?? '');
                if (job) {
                  setClientId(job.client_id);
                  setClientName(job.client_name);
                }
              }}
              placeholder="Any job"
              hint="Optional. A job brings its client, its service and its own hourly rate."
            />
          ) : null}
          <Select
            label="Service"
            options={serviceOptions}
            value={serviceId}
            onChange={(event) => setServiceId(event.target.value)}
            hint="Optional. Overrides the service of the job."
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-end sm:justify-end md:col-span-2">
            <Button onClick={reset}>Clear</Button>
            <Button
              type="submit"
              form={formId}
              variant="primary"
              leftIcon={<Calculator aria-hidden="true" className="size-4" />}
              loading={resolution.isFetching}
              disabled={!canPickStaff}
            >
              Check rate
            </Button>
          </div>
        </form>
      </Card>

      <p role="status" className="sr-only">
        {resolution.data && !resolution.isFetching
          ? `Rate worked out: charge-out ${formatRate(resolution.data.charge_rate)}, cost ${formatRate(resolution.data.cost_rate)}.`
          : ''}
      </p>

      {query === null ? (
        <Card padding="none">
          <EmptyState
            icon={<Calculator className="size-6" />}
            title="Choose who the rate is for"
            description="Pick a person, and a client, job or service if it matters, then check the rate. The levels the rate was chosen from are shown with it."
          />
        </Card>
      ) : resolution.isError ? (
        <LoadError
          title="Could not work out the rate"
          error={resolution.error}
          onRetry={() => void resolution.refetch()}
          retrying={resolution.isRefetching}
        />
      ) : resolution.data && !resolution.isFetching ? (
        <Result resolution={resolution.data} />
      ) : (
        <div role="status" aria-label="Working out the rate">
          <Card padding="sm">
            <Skeleton lines={4} />
          </Card>
        </div>
      )}
    </>
  );
}

/** `/:orgSlug/team/rate-preview`: what charge-out and cost rate a person would get, and why (`rate.read`). */
export default function RatePreviewPage() {
  const { can } = useOrg();
  useDocumentTitle('Rate Preview');
  return (
    <PageShell
      title="Rate Preview"
      description="Check which rate applies to a person on a day, for a client, job or service, and see every level it was chosen from."
    >
      {can(PERMISSIONS.rateRead) ? <RatePreview /> : <NoAccess what="rate previews" />}
    </PageShell>
  );
}
