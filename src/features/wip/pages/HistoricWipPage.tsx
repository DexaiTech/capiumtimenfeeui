import { Ellipsis, History, ListTree, SearchX } from 'lucide-react';
import { useState } from 'react';

import {
  Badge,
  Button,
  ColumnVisibilityMenu,
  CountTabs,
  DataTable,
  DateField,
  Dropdown,
  EmptyState,
  PageToolbar,
  useToast,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle, useUrlParams } from '@/hooks';
import { formatUkDate, formatUkDateTime, todayInZone } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { useExportHistoric, useHistoricReport } from '../api';
import { ExportMenu } from '../components/ExportMenu';
import { FilterPopover } from '../components/FilterPopover';
import { HistoricItemsDialog } from '../components/HistoricItemsDialog';
import { historicColumns } from '../components/historicColumns';
import { LoadError, NoAccess, PageShell } from '../components/PageShell';
import { StatCards, type Stat } from '../components/StatCards';
import { WipFilterFields } from '../components/WipFilterFields';
import { HISTORIC_GROUP_META } from '../constants';
import { CLEARED_FILTERS, useWipFilters } from '../hooks/useWipFilters';
import {
  HISTORIC_GROUPS,
  type BillingType,
  type ExportFormat,
  type HistoricFilters,
  type HistoricItemFilters,
  type HistoricRow,
} from '../types';
import { downloadBlob } from '../utils/download';
import { describeFailure } from '../utils/errors';
import { isoDate, lastMonthEnd } from '../utils/format';

const BILLING_TYPES: ReadonlyArray<string> = ['hourly', 'fixed', 'non_billable'];

/** /:orgSlug/wip/historic: the WIP as it stood at the end of any past day, frozen once read. */
export default function HistoricWipPage() {
  useDocumentTitle('Historic WIP');
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const { params, setParam } = useUrlParams();
  const { filters: base, active, setFilters, clear } = useWipFilters();

  const today = todayInZone(organization.timezone);
  // Today is computed live; a past day is frozen the first time it is read, so the person picks it.
  const asAt = isoDate(params.get('as_at')) ?? today;
  const group = HISTORIC_GROUPS.find((item) => item === params.get('group')) ?? 'client';
  const allowed = can(PERMISSIONS.reportFinancial);

  const filters: HistoricFilters = { ...base, as_at: asAt, group_by: group };
  const report = useHistoricReport(filters, { enabled: allowed });
  const exporter = useExportHistoric();

  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set(['hours']));
  const [drilling, setDrilling] = useState<{ title: string; filters: HistoricItemFilters } | null>(
    null,
  );

  const currency = organization.currency;
  const rows = report.data?.rows ?? [];
  const totals = report.data?.totals;
  const columns = historicColumns({ currency, group });

  const stats: Stat[] = totals
    ? [
        {
          label: 'Time WIP',
          value: formatMoney(totals.time_wip, currency),
          hint: `${totals.hours} hours`,
        },
        { label: 'Fixed fee WIP', value: formatMoney(totals.fixed_fee_wip, currency) },
        { label: 'Expense WIP', value: formatMoney(totals.expense_wip, currency) },
        { label: 'Write-ons', value: formatMoney(totals.write_ons, currency) },
        { label: 'Write-offs', value: formatMoney(totals.write_offs, currency) },
        {
          label: 'Total WIP',
          value: formatMoney(totals.total, currency),
          hint: `${String(totals.item_count)} items`,
        },
      ]
    : [];

  const drill = (row: HistoricRow) => {
    if (!row.key) return;
    const narrowed: HistoricItemFilters = { ...base, as_at: asAt };
    if (group === 'client') narrowed.client_id = row.key;
    else if (group === 'job') narrowed.job_id = row.key;
    else if (BILLING_TYPES.includes(row.key)) narrowed.billing_type = row.key as BillingType;
    setDrilling({ title: row.name, filters: narrowed });
  };

  const exportAs = (format: ExportFormat) =>
    exporter.mutate(
      { filters, format },
      {
        onSuccess: (blob) => downloadBlob(`wip-${asAt}-${group}.${format}`, blob),
        onError: (error) =>
          toast({ tone: 'error', ...describeFailure(error, 'Could not export the report') }),
      },
    );

  if (!allowed) {
    return (
      <PageShell title="Historic WIP" description="Work in progress as at any past date.">
        <NoAccess what="financial reports" />
      </PageShell>
    );
  }

  const snapshot = report.data?.snapshot;

  return (
    <PageShell
      title="Historic WIP"
      description="Work in progress as it stood at the end of any day. Past days are frozen: later invoices, write-offs and rate changes never change them."
      actions={
        <ExportMenu
          onExport={exportAs}
          busy={exporter.isPending}
          allowed={can(PERMISSIONS.reportExport)}
          empty={rows.length === 0}
        />
      }
    >
      {report.data ? (
        <div
          role="note"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text"
        >
          {snapshot ? (
            <Badge tone={snapshot.frozen ? 'green' : 'blue'} size="sm" dot>
              {snapshot.frozen ? 'Frozen' : 'Live'}
            </Badge>
          ) : null}
          <span>{report.data.notice}</span>
          {snapshot?.frozen && snapshot.taken_at ? (
            <span className="text-xs text-text-muted">
              Taken on {formatUkDateTime(snapshot.taken_at, organization.timezone)}
            </span>
          ) : null}
        </div>
      ) : null}
      {totals ? (
        <StatCards
          label={`WIP as at ${formatUkDate(asAt)}`}
          stats={stats}
          className="lg:grid-cols-3 xl:grid-cols-6"
        />
      ) : null}
      {report.isError && !report.data ? (
        <LoadError
          title="Could not load the historic WIP"
          error={report.error}
          onRetry={() => void report.refetch()}
          retrying={report.isRefetching}
        />
      ) : (
        <DataTable
          caption="Historic WIP"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.key ?? `none:${row.name}`}
          hiddenColumns={hidden}
          loading={report.isPending}
          toolbar={
            <PageToolbar
              start={
                <CountTabs
                  label="Group WIP by"
                  items={HISTORIC_GROUPS.map((item) => ({
                    value: item,
                    label: HISTORIC_GROUP_META[item].tab,
                  }))}
                  value={group}
                  onChange={(value) => setParam({ group: value === 'client' ? null : value })}
                />
              }
              actions={
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-text-muted">As at</span>
                    <DateField
                      label="As at date"
                      hideLabel
                      max={today}
                      value={asAt}
                      onChange={(value) => setParam({ as_at: value })}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setParam({ as_at: lastMonthEnd(today) })}
                    >
                      Last month end
                    </Button>
                  </div>
                  <FilterPopover title="Filter historic WIP" count={active} onClear={clear}>
                    <WipFilterFields value={base} onChange={setFilters} />
                  </FilterPopover>
                  <ColumnVisibilityMenu
                    columns={columns.map((column) => ({
                      id: column.id,
                      label: column.header,
                      locked: column.hideable === false,
                    }))}
                    hidden={hidden}
                    onChange={setHidden}
                  />
                </>
              }
            />
          }
          rowActions={(row) =>
            row.key ? (
              <Dropdown
                label={`Actions for ${row.name}`}
                items={[
                  {
                    id: 'items',
                    label: 'See the items',
                    icon: <ListTree aria-hidden="true" className="size-4" />,
                    onSelect: () => drill(row),
                  },
                ]}
                trigger={<Ellipsis aria-hidden="true" className="size-5 text-text-muted" />}
              />
            ) : null
          }
          empty={
            active > 0 ? (
              <EmptyState
                icon={<SearchX className="size-6" />}
                title="No WIP matches"
                description="Try different filters."
                action={<Button onClick={() => setParam(CLEARED_FILTERS)}>Clear filters</Button>}
              />
            ) : (
              <EmptyState
                icon={<History className="size-6" />}
                title="No WIP at that date"
                description="Nothing was unbilled at the end of that day."
              />
            )
          }
        />
      )}

      <HistoricItemsDialog
        title={drilling?.title ?? null}
        filters={drilling?.filters ?? null}
        onClose={() => setDrilling(null)}
      />
    </PageShell>
  );
}
