import { useIsFetching } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

import { PageHeader } from '@/components/layout';
import { Button } from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';

import {
  dashboardKeys,
  useBillingTrend,
  useDashboardCards,
  useDebtorAgeing,
  useMyTimesheet,
  useRefreshDashboard,
  useTopClientsByWip,
} from '../api';
import { BillingTrendChart } from '../components/BillingTrendChart';
import { DebtorAgeingChart } from '../components/DebtorAgeingChart';
import { MyActionsWidget } from '../components/MyActionsWidget';
import { MyTimesheetChart } from '../components/MyTimesheetChart';
import { PendingApprovalsWidget } from '../components/PendingApprovalsWidget';
import { PeriodSwitch } from '../components/PeriodSwitch';
import { SummaryCards } from '../components/SummaryCards';
import { TopClientsChart } from '../components/TopClientsChart';
import { OVERVIEW_MONTHS, OVERVIEW_TOP_CLIENTS } from '../constants';
import { usePeriodParam } from '../hooks/useDashboardParams';
import type { DashboardPeriod } from '../types';
import { dateRange } from '../utils/format';

/* Each widget below asks for its own data, and only mounts when the role includes it. */

function TimesheetWidget() {
  return <MyTimesheetChart query={useMyTimesheet()} />;
}

function TopClientsWidget({ period }: { period: DashboardPeriod }) {
  return <TopClientsChart query={useTopClientsByWip(OVERVIEW_TOP_CLIENTS, period)} viewAll />;
}

function BillingWidget() {
  return <BillingTrendChart query={useBillingTrend(OVERVIEW_MONTHS)} viewAll />;
}

function DebtorsWidget({ period }: { period: DashboardPeriod }) {
  return <DebtorAgeingChart query={useDebtorAgeing(OVERVIEW_TOP_CLIENTS, period)} viewAll />;
}

/**
 * `/:orgSlug/dashboard/overview`: the summary cards for a period and the widgets of the role:
 * My Actions, Pending Approvals, My Timesheet, Top Clients by WIP, Billing Trend and Debtor
 * Ageing. Each widget loads, fails and refreshes on its own.
 */
export default function DashboardOverviewPage() {
  const { organization, can, canAny } = useOrg();
  useDocumentTitle('Dashboard');
  const [period, setPeriod] = usePeriodParam();
  const cards = useDashboardCards(period);
  const refreshAll = useRefreshDashboard();
  const refreshing = useIsFetching({ queryKey: dashboardKeys.all(organization.id) }) > 0;
  const range = cards.data ? dateRange(cards.data.date_from, cards.data.date_to) : null;

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="Overview"
        description="Your week, your actions and the practice's key figures at a glance."
        className="mb-1"
        actions={
          <>
            {range ? <span className="text-xs text-text-muted">{range}</span> : null}
            <PeriodSwitch value={period} onChange={setPeriod} />
            <Button
              variant="outline"
              loading={refreshing}
              leftIcon={<RefreshCw className="size-4" aria-hidden="true" />}
              onClick={() => void refreshAll()}
            >
              Refresh all
            </Button>
          </>
        }
      />
      <SummaryCards query={cards} />
      <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <MyActionsWidget />
        {canAny([P.timesheetApprove, P.expenseApprove]) ? <PendingApprovalsWidget /> : null}
        {can(P.timeLog) ? <TimesheetWidget /> : null}
        {canAny([P.wipRead, P.reportFinancial]) ? <TopClientsWidget period={period} /> : null}
        {canAny([P.invoiceRead, P.reportFinancial]) ? <BillingWidget /> : null}
        {canAny([P.paymentRead, P.invoiceRead, P.reportFinancial]) ? (
          <DebtorsWidget period={period} />
        ) : null}
      </div>
    </section>
  );
}
