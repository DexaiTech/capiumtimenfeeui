import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { Badge, Card, CardHeader } from '@/components/ui';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { formatUkDate, formatUkDateTime, todayInZone } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { useMemberNames } from '../api';
import { BILLING_BASIS_LABEL, isOpenJob } from '../constants';
import type { Job } from '../types';
import { dateSpan, dueNote, isOverdue } from '../utils/format';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 px-5 py-2.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs text-text-muted sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 text-sm text-text">{children}</dd>
    </div>
  );
}

const dash = <span className="text-text-muted">—</span>;

/** What a job is: its client and service, how it is billed, its dates and who runs it. */
export function JobDetailsCard({ job }: { job: Job }) {
  const { organization, can } = useOrg();
  const nameOf = useMemberNames();
  const today = todayInZone(organization.timezone);
  const overdue = isOverdue(job.due_date, job.status, today);
  const note = dueNote(job.due_date, today);
  const period = dateSpan(job.period_start, job.period_end);

  const fee =
    job.billing_basis === 'fixed'
      ? job.fixed_fee === null
        ? 'Fixed fee'
        : `Fixed fee of ${formatMoney(job.fixed_fee, organization.currency)}`
      : job.billing_basis === 'hourly' && job.hourly_rate !== null
        ? `Hourly, at ${formatMoney(job.hourly_rate, organization.currency)} an hour for this job`
        : BILLING_BASIS_LABEL[job.billing_basis];

  return (
    <Card padding="none">
      <CardHeader title="Details" />
      <dl className="flex flex-col divide-y divide-row-border">
        <Row label="Client">
          {can('client.read') ? (
            <Link
              to={routes.org.client(organization.slug, job.client_id)}
              className="text-brand-text hover:underline"
            >
              {job.client_name}
            </Link>
          ) : (
            job.client_name
          )}{' '}
          <span className="text-text-muted">({job.client_code})</span>
        </Row>
        <Row label="Service">{job.service_name ?? dash}</Row>
        <Row label="Billing">{fee}</Row>
        <Row label="Period">{period ?? dash}</Row>
        <Row label="Start date">{job.start_date ? formatUkDate(job.start_date) : dash}</Row>
        <Row label="Due date">
          {job.due_date ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              {formatUkDate(job.due_date)}
              {overdue ? (
                <Badge tone="red" size="sm">
                  Overdue
                </Badge>
              ) : (
                <span className="text-xs text-text-muted">
                  {isOpenJob(job.status) ? note : null}
                </span>
              )}
            </span>
          ) : (
            dash
          )}
        </Row>
        <Row label="Manager">{nameOf(job.manager_user_id) ?? dash}</Row>
        <Row label="Partner">{nameOf(job.partner_user_id) ?? dash}</Row>
        {job.completed_at ? (
          <Row label="Completed">{formatUkDateTime(job.completed_at, organization.timezone)}</Row>
        ) : null}
        {job.closed_at ? (
          <Row label="Closed">{formatUkDateTime(job.closed_at, organization.timezone)}</Row>
        ) : null}
        {job.pm_job_id ? (
          <Row label="Linked job">
            Linked since {formatUkDate(job.pm_linked_at)}: its name, service, manager, partner and
            dates are managed there.
          </Row>
        ) : null}
        <Row label="Created">{formatUkDateTime(job.created_at, organization.timezone)}</Row>
      </dl>
    </Card>
  );
}
