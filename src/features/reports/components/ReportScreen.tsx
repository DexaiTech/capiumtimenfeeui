import { ChartColumn, ExternalLink, SearchX } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import {
  Button,
  DataTable,
  DateField,
  DateRangeField,
  EmptyState,
  PageToolbar,
  Select,
  sortRows,
  useToast,
  type DataTableSort,
  RowActions,
} from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle, useUrlParams } from '@/hooks';
import { todayInZone } from '@/utils/dates';

import { reportsApi, useReport, type ReportQuery } from '../api';
import { FILTER_PARAMS, type FilterKey, type ReportConfig, type ReportContext } from '../config';
import type { ExportFormat } from '../types';
import { downloadBlob } from '../utils/download';
import { describeFailure } from '../utils/errors';
import { isoParam, presetOf, rangePresets } from '../utils/period';
import { ExportMenu } from './ExportMenu';
import { FilterPopover } from './FilterPopover';
import { LoadError, NoAccess, PageShell } from './PageShell';
import { ReportFilters } from './ReportFilters';
import { StatCards } from './StatCards';

const ALL_FORMATS: ReadonlyArray<ExportFormat> = ['csv', 'xlsx', 'pdf'];

function Report<TRow, TTotals>({ config }: { config: ReportConfig<TRow, TTotals> }) {
  const { organization, can } = useOrg();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { params, setParam } = useUrlParams();
  const [sort, setSort] = useState<DataTableSort | null>(null);
  const [exporting, setExporting] = useState(false);
  const today = todayInZone(organization.timezone);
  const presets = rangePresets(today);

  const group =
    config.groups?.find((item) => item.value === params.get('group'))?.value ??
    config.groups?.[0]?.value;
  const defaultPreset =
    config.period === 'range'
      ? presets.find((preset) => preset.value === config.defaultPreset)
      : undefined;
  const from = isoParam(params.get('from')) || defaultPreset?.from || '';
  const to = isoParam(params.get('to')) || defaultPreset?.to || '';
  const asAt = isoParam(params.get('as_at'));
  const weekFrom = isoParam(params.get('week_from'));
  const weekTo = isoParam(params.get('week_to'));

  const values = Object.fromEntries(
    (Object.keys(FILTER_PARAMS) as FilterKey[]).map((key) => [
      key,
      config.filters.includes(key) ? (params.get(FILTER_PARAMS[key].param) ?? '') : '',
    ]),
  ) as Record<FilterKey, string>;
  const filterCount = config.filters.filter((key) => values[key] !== '').length;

  // Only what the person chose (or the report's own period) is sent: the report fills in the rest.
  const query: ReportQuery = {
    ...(config.period === 'range'
      ? { date_from: from || undefined, date_to: to || undefined }
      : {}),
    ...(config.period === 'as_at' ? { as_at: asAt || undefined } : {}),
    ...(config.period === 'weeks'
      ? { week_from: weekFrom || undefined, week_to: weekTo || undefined }
      : {}),
    ...(group ? { group_by: group } : {}),
    ...Object.fromEntries(
      config.filters.map((key) => [FILTER_PARAMS[key].query, values[key] || undefined]),
    ),
  };

  const report = useReport<TRow, TTotals>(config.endpoint, query);
  const data = report.data;
  const contextOf = (totals: TTotals | undefined): ReportContext<TTotals> => ({
    currency: organization.currency,
    timeZone: organization.timezone,
    slug: organization.slug,
    group,
    totals,
  });
  const ctx = contextOf(data?.totals);
  const columns = config.columns(ctx);
  const rows = data ? sortRows(data.rows, columns, sort) : [];
  const shown = {
    from: from || data?.filters.date_from || '',
    to: to || data?.filters.date_to || '',
    asAt: asAt || data?.filters.as_at || today,
  };

  const exportFile = async (format: ExportFormat) => {
    setExporting(true);
    try {
      const blob = await reportsApi.download(organization.id, config.endpoint, query, format);
      // The file is named after the last day it covers.
      const lastDay =
        config.period === 'as_at'
          ? shown.asAt
          : config.period === 'range'
            ? shown.to
            : weekTo || data?.filters.week_to;
      downloadBlob(`${config.fileName}-${lastDay || today}.${format}`, blob);
    } catch (error) {
      toast({ tone: 'error', ...describeFailure(error, 'Could not download the report') });
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () =>
    setParam(Object.fromEntries(config.filters.map((key) => [FILTER_PARAMS[key].param, null])));

  const periodControls =
    config.period === 'range' ? (
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <Select
          label="Period"
          hideLabel
          options={[
            ...presets.map((preset) => ({ value: preset.value, label: preset.label })),
            { value: 'custom', label: 'Custom dates' },
          ]}
          value={presetOf(shown.from, shown.to, presets)}
          onChange={(event) => {
            const preset = presets.find((item) => item.value === event.target.value);
            if (preset) setParam({ from: preset.from, to: preset.to });
          }}
          className="w-full sm:w-40"
        />
        <DateRangeField
          label="Dates"
          hideLabel
          prefix="Dates"
          value={{ from: shown.from || null, to: shown.to || null }}
          onChange={(range) => setParam({ from: range.from, to: range.to })}
          className="w-full sm:w-80"
        />
      </div>
    ) : config.period === 'as_at' ? (
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted">As at</span>
        <DateField
          label="As at date"
          hideLabel
          max={today}
          value={shown.asAt}
          onChange={(value) => setParam({ as_at: value && value !== today ? value : null })}
        />
        {asAt ? (
          <Button size="sm" variant="ghost" onClick={() => setParam({ as_at: null })}>
            Today
          </Button>
        ) : null}
      </div>
    ) : (
      <DateRangeField
        label="Weeks"
        hideLabel
        prefix="Weeks"
        endsToday={false}
        value={{
          from: weekFrom || data?.filters.week_from || null,
          to: weekTo || data?.filters.week_to || null,
        }}
        onChange={(range) => setParam({ week_from: range.from, week_to: range.to })}
        className="w-full sm:w-80"
      />
    );

  const rowActions = config.drill
    ? (row: TRow) => {
        const target = config.drill?.(row, ctx, shown);
        return target ? (
          <RowActions
            label={`Actions for ${config.rowLabel(row)}`}
            items={[
              {
                id: 'open',
                label: target.label,
                icon: <ExternalLink aria-hidden="true" className="size-4" />,
                onSelect: () => void navigate(target.to),
              },
            ]}
          />
        ) : null;
      }
    : undefined;

  return (
    <>
      <PageToolbar
        start={
          config.groups && config.groups.length > 1 ? (
            <Select
              label="Group by"
              options={config.groups.map((item) => ({ value: item.value, label: item.label }))}
              value={group ?? ''}
              onChange={(event) =>
                setParam({
                  group:
                    event.target.value === config.groups?.[0]?.value ? null : event.target.value,
                })
              }
              className="w-full sm:w-44"
            />
          ) : undefined
        }
        search={periodControls}
        actions={
          <>
            {config.filters.length > 0 ? (
              <FilterPopover
                title={`Filter the ${config.what}`}
                count={filterCount}
                onClear={clearFilters}
              >
                <ReportFilters
                  filters={config.filters}
                  personLabel={config.personLabel}
                  values={values}
                  onChange={setParam}
                />
              </FilterPopover>
            ) : null}
            <ExportMenu
              formats={config.formats ?? ALL_FORMATS}
              onExport={(format) => void exportFile(format)}
              busy={exporting}
              allowed={can(P.reportExport)}
              empty={(data?.rows.length ?? 0) === 0}
            />
          </>
        }
      />

      {report.isError && !data ? (
        <LoadError
          title={`Could not load the ${config.what}`}
          error={report.error}
          onRetry={() => void report.refetch()}
          retrying={report.isRefetching}
        />
      ) : (
        <>
          {data ? (
            <StatCards label={`${config.title} figures`} stats={config.stats(data.totals, ctx)} />
          ) : null}
          {data && data.rows.length > 0
            ? config.chart?.({ rows: data.rows, totals: data.totals }, ctx)
            : null}
          <DataTable
            caption={config.title}
            columns={columns}
            rows={rows}
            rowKey={(row) => config.rowKey(row)}
            sort={sort}
            onSortChange={setSort}
            loading={report.isPending}
            rowActions={rowActions}
            // The same step as the menu's first item, one click: the row opens what is behind it.
            onRowClick={
              config.drill
                ? (row) => {
                    const target = config.drill?.(row, ctx, shown);
                    if (target) void navigate(target.to);
                  }
                : undefined
            }
            empty={
              filterCount > 0 ? (
                <EmptyState
                  icon={<SearchX className="size-6" />}
                  title="Nothing matches"
                  description="Try other dates or fewer filters."
                  action={<Button onClick={clearFilters}>Clear filters</Button>}
                />
              ) : (
                <EmptyState
                  icon={<ChartColumn className="size-6" />}
                  title={config.emptyTitle}
                  description={config.emptyDescription}
                />
              )
            }
            footer={
              data && rows.length > 0 && config.note ? (
                <p className="border-t border-row-border px-4 py-2 text-xs text-text-muted">
                  {config.note}
                </p>
              ) : undefined
            }
          />
        </>
      )}
    </>
  );
}

/** One report of the Reports module, whatever it measures: see `ReportConfig`. */
export function ReportScreen<TRow, TTotals>({ config }: { config: ReportConfig<TRow, TTotals> }) {
  useDocumentTitle(config.title);
  const { can } = useOrg();
  return (
    <PageShell title={config.title} description={config.description}>
      {config.access.some((permission) => can(permission)) ? (
        <Report config={config} />
      ) : (
        <NoAccess what={config.what} />
      )}
    </PageShell>
  );
}
