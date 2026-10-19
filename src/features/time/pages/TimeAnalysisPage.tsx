import { ChartColumn, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';

import { BarChart } from '@/components/charts';
import {
  Button,
  DataTable,
  DateRangeField,
  EmptyState,
  PageToolbar,
  Select,
  sortRows,
  useToast,
  type DataTableColumn,
  type DataTableSort,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import {
  ClientPicker,
  JobPicker,
  StaffPicker,
  useActivityTypes,
  useServices,
} from '@/features/team';
import { useDocumentTitle, useUrlParams } from '@/hooks';
import { isApiError } from '@/services/api';
import { todayInZone } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';
import { formatBasisPoints, formatMoney } from '@/utils/money';

import { timeApi, useTimeSummary, useUtilisation } from '../api';
import { ExportMenu } from '../components/analysis/ExportMenu';
import { KpiCards } from '../components/analysis/KpiCards';
import { UtilisationCard } from '../components/analysis/UtilisationCard';
import { FilterPopover } from '../components/FilterPopover';
import { LoadError, NoAccess, PageShell } from '../components/PageShell';
import { GROUP_BY_OPTIONS } from '../constants';
import type {
  ExportFormat,
  TimeGroupBy,
  TimeSummaryFilters,
  TimeSummaryRow,
  UtilisationFilters,
} from '../types';
import { chartRows, groupLabel, presetOf, rangePresets, valueLessCost } from '../utils/analysis';
import { downloadBlob } from '../utils/download';
import { describeFailure } from '../utils/errors';
import { isIsoDate } from '../utils/weeks';

const GROUPS = GROUP_BY_OPTIONS.map((option) => option.value);

function Analysis() {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const { params, setParam } = useUrlParams();
  const currency = organization.currency;
  const today = todayInZone(organization.timezone);
  const presets = useMemo(
    () => rangePresets(today, organization.week_start),
    [today, organization.week_start],
  );

  const monthPreset = presets.find((preset) => preset.value === 'this-month');
  const rawFrom = params.get('from');
  const rawTo = params.get('to');
  const from = isIsoDate(rawFrom) ? rawFrom : (monthPreset?.from ?? today);
  const to = isIsoDate(rawTo) ? rawTo : today;
  const group: TimeGroupBy = GROUPS.find((item) => item === params.get('group')) ?? 'person';
  const person = params.get('person') ?? '';
  const clientId = params.get('client') ?? '';
  const jobId = params.get('job') ?? '';
  const serviceId = params.get('service') ?? '';
  const activityId = params.get('activity') ?? '';

  const canPickPeople = can(PERMISSIONS.timeReadAll) && can(PERMISSIONS.memberRead);

  const filters = useMemo<TimeSummaryFilters>(
    () => ({
      date_from: from,
      date_to: to,
      group_by: group,
      client_id: clientId || undefined,
      job_id: jobId || undefined,
      user_id: person || undefined,
      service_id: serviceId || undefined,
      activity_code_id: activityId || undefined,
    }),
    [from, to, group, clientId, jobId, person, serviceId, activityId],
  );
  const utilisationFilters = useMemo<UtilisationFilters>(
    () => ({ date_from: from, date_to: to, user_id: person || undefined }),
    [from, to, person],
  );
  const summary = useTimeSummary(filters);
  const utilisation = useUtilisation(utilisationFilters);
  const services = useServices();
  const activities = useActivityTypes();

  const [sort, setSort] = useState<DataTableSort | null>(null);
  const [exporting, setExporting] = useState(false);

  const data = summary.data;
  const showCost = data !== undefined && data.totals.cost_value !== null;
  const label = (row: TimeSummaryRow) => groupLabel(group, row);

  const columns: DataTableColumn<TimeSummaryRow>[] = [
    {
      id: 'name',
      header: GROUP_BY_OPTIONS.find((option) => option.value === group)?.label ?? 'Group',
      sortable: true,
      sortValue: (row) => label(row),
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-text uppercase">{label(row)}</span>
          {row.code || row.client_name ? (
            <span className="text-text-muted">
              {[row.code, row.client_name].filter(Boolean).join(' · ')}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'entries',
      header: 'Entries',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.entry_count,
      className: 'tabular-nums',
      cell: (row) => row.entry_count,
    },
    {
      id: 'total',
      header: 'Total',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.total_minutes,
      className: 'whitespace-nowrap tabular-nums',
      cell: (row) => <span className="font-semibold">{formatMinutes(row.total_minutes)}</span>,
    },
    {
      id: 'chargeable',
      header: 'Chargeable',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.chargeable_minutes,
      className: 'whitespace-nowrap tabular-nums',
      cell: (row) => formatMinutes(row.chargeable_minutes),
    },
    {
      id: 'nonChargeable',
      header: 'Non-chargeable',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.non_chargeable_minutes,
      className: 'whitespace-nowrap tabular-nums',
      cell: (row) => formatMinutes(row.non_chargeable_minutes),
    },
    {
      id: 'share',
      header: 'Chargeable %',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.chargeable_bp,
      className: 'whitespace-nowrap tabular-nums',
      cell: (row) => formatBasisPoints(row.chargeable_bp),
    },
    {
      id: 'value',
      header: 'Value',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.charge_value,
      className: 'whitespace-nowrap tabular-nums',
      cell: (row) => formatMoney(row.charge_value, currency),
    },
    ...(showCost
      ? [
          {
            id: 'cost',
            header: 'Cost',
            align: 'end',
            sortable: true,
            sortValue: (row: TimeSummaryRow) => row.cost_value,
            className: 'whitespace-nowrap tabular-nums',
            cell: (row: TimeSummaryRow) =>
              row.cost_value === null ? '—' : formatMoney(row.cost_value, currency),
          } satisfies DataTableColumn<TimeSummaryRow>,
          {
            id: 'margin',
            header: 'Value less cost',
            align: 'end',
            sortable: true,
            sortValue: (row: TimeSummaryRow) => valueLessCost(row),
            className: 'whitespace-nowrap tabular-nums',
            cell: (row: TimeSummaryRow) => {
              const margin = valueLessCost(row);
              return margin === null ? '—' : formatMoney(margin, currency);
            },
          } satisfies DataTableColumn<TimeSummaryRow>,
        ]
      : []),
  ];

  const rows = sortRows(data?.rows ?? [], columns, sort);
  const chart = chartRows(data?.rows ?? [], group);
  const periods = group === 'day' || group === 'week' || group === 'month';
  const filterCount = [person, clientId, jobId, serviceId, activityId].filter(Boolean).length;
  const clearFilters = () =>
    setParam({ person: null, client: null, job: null, service: null, activity: null });
  const groupName = GROUP_BY_OPTIONS.find((option) => option.value === group)?.label ?? 'Group';

  const exportFile = async (format: ExportFormat) => {
    setExporting(true);
    try {
      const file = await timeApi.exportTimeSummary(organization.id, filters, format);
      downloadBlob(`${organization.slug}-time-analysis-${from}-${to}.${format}`, file);
      toast({
        tone: 'success',
        title: 'Export ready',
        description: `Saved as ${format.toUpperCase()}.`,
      });
    } catch (error) {
      const notice = describeFailure(error, 'Could not export the report');
      toast({
        tone: 'error',
        title:
          isApiError(error) && error.status === 403 ? 'Exporting needs permission' : notice.title,
        description: notice.description,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageToolbar
        start={
          <Select
            label="Group by"
            options={GROUP_BY_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            value={group}
            onChange={(event) =>
              setParam({ group: event.target.value === 'person' ? null : event.target.value })
            }
            className="w-full sm:w-40"
          />
        }
        search={
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <Select
              label="Period"
              hideLabel
              options={[
                ...presets.map((preset) => ({ value: preset.value, label: preset.label })),
                { value: 'custom', label: 'Custom dates' },
              ]}
              value={presetOf(from, to, presets)}
              onChange={(event) => {
                const preset = presets.find((item) => item.value === event.target.value);
                if (preset) setParam({ from: preset.from, to: preset.to });
              }}
              className="w-full sm:w-36"
            />
            <DateRangeField
              label="Date"
              hideLabel
              prefix="Dates"
              value={{ from, to }}
              onChange={(range) => setParam({ from: range.from, to: range.to })}
              className="w-full sm:w-80"
            />
          </div>
        }
        actions={
          <>
            <FilterPopover title="Filter time analysis" count={filterCount} onClear={clearFilters}>
              {canPickPeople ? (
                <StaffPicker
                  label="Person"
                  value={person || null}
                  includeLeft
                  placeholder="Everyone"
                  onChange={(id) => setParam({ person: id })}
                />
              ) : null}
              {can(PERMISSIONS.clientRead) ? (
                <ClientPicker
                  label="Client"
                  value={clientId || null}
                  placeholder="Any client"
                  onChange={(id) => setParam({ client: id, job: null })}
                />
              ) : null}
              {can(PERMISSIONS.jobRead) ? (
                <JobPicker
                  label="Job"
                  value={jobId || null}
                  clientId={clientId || null}
                  placeholder="Any job"
                  onChange={(job) => setParam({ job: job?.id ?? null })}
                />
              ) : null}
              <Select
                label="Service"
                options={[
                  { value: '', label: 'Any service' },
                  ...(services.data ?? []).map((service) => ({
                    value: service.id,
                    label: service.name,
                  })),
                ]}
                value={serviceId}
                onChange={(event) => setParam({ service: event.target.value })}
              />
              <Select
                label="Activity"
                options={[
                  { value: '', label: 'Any activity' },
                  ...(activities.data ?? []).map((activity) => ({
                    value: activity.id,
                    label: activity.name,
                  })),
                ]}
                value={activityId}
                onChange={(event) => setParam({ activity: event.target.value })}
              />
            </FilterPopover>
            <ExportMenu
              onExport={(format) => void exportFile(format)}
              busy={exporting}
              allowed={can(PERMISSIONS.reportExport)}
              empty={(data?.rows.length ?? 0) === 0}
            />
          </>
        }
      />

      {summary.isError && !data ? (
        <LoadError
          title="Could not load the time analysis"
          error={summary.error}
          onRetry={() => void summary.refetch()}
          retrying={summary.isRefetching}
        />
      ) : (
        <>
          <KpiCards totals={data?.totals} currency={currency} />
          <BarChart
            title={`Time by ${groupName.toLowerCase()}`}
            description={
              periods || chart.length === (data?.rows.length ?? 0)
                ? 'Chargeable and non-chargeable time.'
                : `The ${chart.length} biggest of ${data?.rows.length ?? 0}; the table below lists them all.`
            }
            data={chart.map((row) => ({
              name: label(row),
              chargeable: row.chargeable_minutes,
              non_chargeable: row.non_chargeable_minutes,
            }))}
            xKey="name"
            series={[
              { key: 'chargeable', label: 'Chargeable', color: 'primary' },
              { key: 'non_chargeable', label: 'Non-chargeable', color: 'muted' },
            ]}
            stacked
            horizontal={!periods}
            legend
            yFormatter={(value) => formatMinutes(value)}
            tableColumns={[
              { key: 'name', label: groupName, align: 'start' },
              { key: 'chargeable', label: 'Chargeable', align: 'end' },
              { key: 'non_chargeable', label: 'Non-chargeable', align: 'end' },
            ]}
            loading={summary.isPending}
            emptyTitle="No time in these dates"
            emptyDescription="Change the dates or the filters."
            aspect={periods ? 16 / 7 : 16 / Math.max(5, Math.min(12, chart.length + 3))}
          />
          <DataTable
            caption={`Time by ${groupName.toLowerCase()}`}
            columns={columns}
            rows={rows}
            rowKey={(row) => row.key ?? `none-${row.name}`}
            sort={sort}
            onSortChange={setSort}
            loading={summary.isPending}
            empty={
              filterCount > 0 ? (
                <EmptyState
                  icon={<SearchX className="size-6" />}
                  title="No time matches"
                  description="Try other dates or fewer filters."
                  action={<Button onClick={clearFilters}>Clear filters</Button>}
                />
              ) : (
                <EmptyState
                  icon={<ChartColumn className="size-6" />}
                  title="No time in these dates"
                  description="Choose other dates to see what was recorded."
                />
              )
            }
            footer={
              data && rows.length > 0 ? (
                <p className="flex flex-wrap gap-x-6 gap-y-1 border-t border-row-border px-4 py-2 text-xs text-text-muted tabular-nums">
                  <span>
                    Total{' '}
                    <strong className="text-text">
                      {formatMinutes(data.totals.total_minutes)}
                    </strong>
                  </span>
                  <span>
                    Chargeable{' '}
                    <strong className="text-text">
                      {formatMinutes(data.totals.chargeable_minutes)} (
                      {formatBasisPoints(data.totals.chargeable_bp)})
                    </strong>
                  </span>
                  <span>
                    Value{' '}
                    <strong className="text-text">
                      {formatMoney(data.totals.charge_value, currency)}
                    </strong>
                  </span>
                  {data.totals.cost_value !== null ? (
                    <span>
                      Cost{' '}
                      <strong className="text-text">
                        {formatMoney(data.totals.cost_value, currency)}
                      </strong>
                    </span>
                  ) : null}
                </p>
              ) : null
            }
          />
          <UtilisationCard
            data={utilisation.data}
            loading={utilisation.isPending}
            error={utilisation.isError ? utilisation.error : null}
            onRetry={() => void utilisation.refetch()}
            retrying={utilisation.isRefetching}
          />
        </>
      )}
    </>
  );
}

/**
 * Time Analysis: where the time went, grouped by person, client, job, activity, service or period,
 * with the totals, a chart, the figures, utilisation against targets and the export. Cost and
 * value less cost appear only for people who may see rates.
 */
export default function TimeAnalysisPage() {
  useDocumentTitle('Time Analysis');
  const { can } = useOrg();
  return (
    <PageShell
      title="Time Analysis"
      description="Chargeable and non-chargeable time, by person, client, job, activity, service or period."
    >
      {can(PERMISSIONS.reportRead) ? <Analysis /> : <NoAccess what="time reports" />}
    </PageShell>
  );
}
