import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { PageHeader } from '@/components/layout';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';
import { addDays, todayInZone } from '@/utils/dates';

import { useTicketDashboard } from '../api';
import {
  AssigneesCard,
  PriorityCard,
  StatusCard,
  TagCard,
  TrendCard,
} from '../components/dashboard/DashboardCards';
import { DateRangeButton } from '../components/dashboard/DateRangeButton';
import { KpiCards } from '../components/dashboard/KpiCards';
import { RecentTicketsCard } from '../components/dashboard/RecentTicketsCard';
import { LiveRegion } from '../components/LiveRegion';
import { LoadError, NoAccess } from '../components/Notices';
import { useTicketFieldChange } from '../hooks/useTicketFieldChange';
import type { DashboardRange } from '../types';
import { isoDateOrUndefined, type DateSpan } from '../utils/range';

function Dashboard() {
  const { organization } = useOrg();
  const [params, setParams] = useSearchParams();
  const range = useMemo<DashboardRange>(
    () => ({
      date_from: isoDateOrUndefined(params.get('date_from')),
      date_to: isoDateOrUndefined(params.get('date_to')),
    }),
    [params],
  );
  const dashboard = useTicketDashboard(range);
  const { change, announcement } = useTicketFieldChange();
  const data = dashboard.data;
  const today = todayInZone(organization.timezone);
  // The API answers with the range it used; until then show what will be asked for.
  const shown: DateSpan = data
    ? { from: data.date_from, to: data.date_to }
    : {
        from: range.date_from ?? addDays(range.date_to ?? today, -18),
        to: range.date_to ?? today,
      };

  const apply = (next: DateSpan) =>
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        updated.set('date_from', next.from);
        updated.set('date_to', next.to);
        return updated;
      },
      { replace: true },
    );

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="Application Testing Dashboard"
        description="Overview of bugs, enhancements and issue status"
        actions={<DateRangeButton range={shown} today={today} onApply={apply} />}
        className="mb-1"
      />
      <LiveRegion message={announcement} />
      {dashboard.isError && !data ? (
        <LoadError
          title="Could not load the dashboard"
          error={dashboard.error}
          onRetry={() => void dashboard.refetch()}
          retrying={dashboard.isRefetching}
        />
      ) : (
        <>
          <KpiCards kpis={data?.kpis} />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <StatusCard data={data} />
            <PriorityCard data={data} />
            <TagCard data={data} className="md:col-span-2 xl:col-span-1" />
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2">
              <RecentTicketsCard
                data={data}
                onStatusChange={(ticket, status) => change(ticket, { status })}
                onPriorityChange={(ticket, priority) => change(ticket, { priority })}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <TrendCard data={data} />
              <AssigneesCard data={data} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/** `/:orgSlug/application-testing/dashboard`: the overview of bugs, enhancements and issue status (`ticket.read`). */
export default function TicketsDashboardPage() {
  const { can } = useOrg();
  useDocumentTitle('Application Testing Dashboard');
  return can(PERMISSIONS.ticketRead) ? <Dashboard /> : <NoAccess what="Application Testing" />;
}
