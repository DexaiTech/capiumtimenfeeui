import { CalendarClock, Repeat, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  Button,
  CountTabs,
  DataTable,
  EmptyState,
  PageToolbar,
  Pagination,
  SearchField,
} from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { ClientPicker } from '@/features/clients';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle, useUrlParams } from '@/hooks';

import { flattenPages, useScheduleList } from '../api';
import { FilterPopover } from '../components/FilterPopover';
import { LoadError, NoAccess, PageShell } from '../components/PageShell';
import { ScheduleDetailDialog } from '../components/recurring/ScheduleDetailDialog';
import { ScheduleFormDialog } from '../components/recurring/ScheduleFormDialog';
import { scheduleColumns } from '../components/recurring/scheduleColumns';
import { SCHEDULE_STATUS_LABELS, SCHEDULE_TAB_ORDER } from '../constants';
import { useUrlSearch } from '../hooks/useUrlSearch';
import type { Schedule, ScheduleListFilters, ScheduleStatus } from '../types';

type ScheduleTab = 'all' | ScheduleStatus;

const TABS: ReadonlyArray<{ value: ScheduleTab; label: string }> = [
  { value: 'all', label: 'All' },
  ...SCHEDULE_TAB_ORDER.map((status) => ({
    value: status,
    label: SCHEDULE_STATUS_LABELS[status].label,
  })),
];

/** The form is closed, setting up a new schedule, or changing one. */
type FormState = { mode: 'new' } | { mode: 'edit'; schedule: Schedule } | null;

function ScheduleList() {
  const { organization, can } = useOrg();
  const { params, setParam } = useUrlParams();
  const { text: searchText, setText: setSearchText, searched } = useUrlSearch();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(null);

  const tabParam = params.get('tab');
  const tab: ScheduleTab = TABS.find((item) => item.value === tabParam)?.value ?? 'all';
  const clientId = params.get('client') ?? '';
  const canPickClient = can(P.clientRead);
  // A new schedule needs the client lookup, and the API checks `recurring.manage` again.
  const canCreate = can(P.recurringManage) && canPickClient;

  const filters = useMemo<ScheduleListFilters>(
    () => ({
      client_id: clientId || undefined,
      status: tab === 'all' ? undefined : [tab],
      q: searched || undefined,
    }),
    [clientId, tab, searched],
  );
  const schedules = useScheduleList(filters);
  const loaded = useMemo(() => flattenPages(schedules.data), [schedules.data]);
  const columns = useMemo(
    () =>
      scheduleColumns({ currency: organization.currency, onOpen: (row) => setDetailId(row.id) }),
    [organization.currency],
  );
  const filtered = Boolean(searched) || tab !== 'all' || clientId !== '';
  // There is no summary endpoint: a tab shows its count once its whole list is loaded.
  const tabCount = (value: ScheduleTab): number | undefined =>
    value === tab && schedules.data && !schedules.hasNextPage ? loaded.length : undefined;

  if (schedules.isError && !schedules.data) {
    return (
      <LoadError
        title="Could not load the recurring invoices"
        error={schedules.error}
        onRetry={() => void schedules.refetch()}
        retrying={schedules.isRefetching}
      />
    );
  }

  const clearFilters = () => {
    setSearchText('');
    setParam({ q: null, tab: null, client: null });
  };

  return (
    <>
      <DataTable
        caption="Recurring invoices"
        columns={columns}
        rows={loaded}
        rowKey={(schedule) => schedule.id}
        onRowClick={(schedule) => setDetailId(schedule.id)}
        loading={schedules.isPending}
        toolbar={
          <PageToolbar
            start={
              <CountTabs
                label="Schedule statuses"
                items={TABS.map((item) => ({ ...item, count: tabCount(item.value) }))}
                value={tab}
                onChange={(value) => setParam({ tab: value === 'all' ? null : value })}
              />
            }
            search={
              <SearchField
                label="Search schedules"
                placeholder="Search name, reference or client"
                value={searchText}
                onChange={setSearchText}
              />
            }
            actions={
              canPickClient ? (
                <FilterPopover
                  title="Filter schedules"
                  count={clientId ? 1 : 0}
                  onClear={() => setParam({ client: null })}
                >
                  <ClientPicker
                    label="Client"
                    value={clientId || null}
                    onChange={(client) => setParam({ client: client?.id ?? null })}
                    listPlacement="inline"
                  />
                </FilterPopover>
              ) : undefined
            }
            primaryAction={
              canCreate ? (
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={<CalendarClock aria-hidden="true" className="size-4" />}
                  onClick={() => setForm({ mode: 'new' })}
                >
                  New schedule
                </Button>
              ) : undefined
            }
          />
        }
        empty={
          filtered ? (
            <EmptyState
              icon={<SearchX className="size-6" />}
              title="No schedules match"
              description="Try a different search, status or client."
              action={<Button onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              icon={<Repeat className="size-6" />}
              title="No recurring invoices yet"
              description="A schedule drafts an invoice on its start date and then each period, for fees that repeat. It never issues the invoice: you review and issue each draft."
              action={
                canCreate ? (
                  <Button variant="primary" onClick={() => setForm({ mode: 'new' })}>
                    New schedule
                  </Button>
                ) : undefined
              }
            />
          )
        }
        footer={
          loaded.length > 0 ? (
            <div className="border-t border-row-border px-4 py-2">
              <Pagination
                hasMore={schedules.hasNextPage}
                onLoadMore={() => void schedules.fetchNextPage()}
                loading={schedules.isFetchingNextPage}
                count={loaded.length}
                itemLabel={['schedule', 'schedules']}
              />
            </div>
          ) : null
        }
      />
      <ScheduleDetailDialog
        key={detailId ?? 'none'}
        scheduleId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={(schedule) => {
          setDetailId(null);
          setForm({ mode: 'edit', schedule });
        }}
      />
      {form ? (
        <ScheduleFormDialog
          open
          schedule={form.mode === 'edit' ? form.schedule : null}
          onClose={() => {
            // Leaving the edit goes back to the schedule it started from.
            if (form.mode === 'edit') setDetailId(form.schedule.id);
            setForm(null);
          }}
          onSaved={(schedule) => {
            setForm(null);
            setDetailId(schedule.id);
          }}
        />
      ) : null}
    </>
  );
}

/** `/:orgSlug/billing/recurring`: schedules that draft invoices, and their runs (`recurring.read`). */
export default function RecurringInvoicesPage() {
  const { can } = useOrg();
  useDocumentTitle('Recurring invoices');
  return (
    <PageShell
      title="Recurring invoices"
      description="Schedules that draft an invoice each period for fees that repeat. You review and issue every draft: nothing is issued automatically."
    >
      {can(P.recurringRead) ? <ScheduleList /> : <NoAccess what="recurring invoices" />}
    </PageShell>
  );
}
