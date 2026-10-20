import { FilePlus2, FileSignature, SearchX } from 'lucide-react';
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
import { formatMoney } from '@/utils/money';

import { flattenPages, useEstimateList, useEstimateSummary } from '../api';
import { EstimateDetailDialog } from '../components/estimates/EstimateDetailDialog';
import { EstimateFormDialog } from '../components/estimates/EstimateFormDialog';
import { estimateColumns } from '../components/estimates/estimateColumns';
import { FilterPopover } from '../components/FilterPopover';
import { LoadError, NoAccess, PageShell } from '../components/PageShell';
import { ESTIMATE_STATUS_LABELS, ESTIMATE_TAB_ORDER } from '../constants';
import { useUrlSearch } from '../hooks/useUrlSearch';
import type { Estimate, EstimateDisplayStatus, EstimateListFilters } from '../types';

type EstimateTab = 'all' | EstimateDisplayStatus;

const TABS: ReadonlyArray<{ value: EstimateTab; label: string }> = [
  { value: 'all', label: 'All' },
  ...ESTIMATE_TAB_ORDER.map((status) => ({
    value: status,
    label: ESTIMATE_STATUS_LABELS[status].label,
  })),
];

/** The form is closed, raising a new estimate, or changing a draft. */
type FormState = { mode: 'new' } | { mode: 'edit'; estimate: Estimate } | null;

function EstimateList() {
  const { organization, can } = useOrg();
  const { params, setParam } = useUrlParams();
  const { text: searchText, setText: setSearchText, searched } = useUrlSearch();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(null);

  const tabParam = params.get('tab');
  const tab: EstimateTab = TABS.find((item) => item.value === tabParam)?.value ?? 'all';
  const clientId = params.get('client') ?? '';
  const canPickClient = can(P.clientRead);
  // A new estimate needs the client lookup, and the API checks `estimate.manage` again.
  const canCreate = can(P.estimateManage) && canPickClient;

  const filters = useMemo<EstimateListFilters>(
    () => ({
      client_id: clientId || undefined,
      status: tab === 'all' ? undefined : [tab],
      q: searched || undefined,
    }),
    [clientId, tab, searched],
  );
  const estimates = useEstimateList(filters);
  const summary = useEstimateSummary(filters);
  const loaded = useMemo(() => flattenPages(estimates.data), [estimates.data]);
  const columns = useMemo(
    () =>
      estimateColumns({ currency: organization.currency, onOpen: (row) => setDetailId(row.id) }),
    [organization.currency],
  );

  const counts = summary.data?.counts;
  const tabCount = (value: EstimateTab): number | undefined =>
    counts
      ? counts[value === 'all' ? 'total' : value]
      : value === tab && estimates.data && !estimates.hasNextPage
        ? loaded.length
        : undefined;
  const filtered = Boolean(searched) || tab !== 'all' || clientId !== '';

  if (estimates.isError && !estimates.data) {
    return (
      <LoadError
        title="Could not load the estimates"
        error={estimates.error}
        onRetry={() => void estimates.refetch()}
        retrying={estimates.isRefetching}
      />
    );
  }

  const clearFilters = () => {
    setSearchText('');
    setParam({ q: null, tab: null, client: null });
  };
  const newButton = canCreate ? (
    <Button variant="primary" onClick={() => setForm({ mode: 'new' })}>
      New estimate
    </Button>
  ) : undefined;

  return (
    <>
      {summary.data ? (
        <p className="text-sm text-text-muted">
          Open estimates, sent and not yet answered, are worth{' '}
          <strong className="font-semibold text-text">
            {formatMoney(summary.data.open_gross, organization.currency)}
          </strong>{' '}
          including VAT.
        </p>
      ) : null}
      <DataTable
        caption="Estimates"
        columns={columns}
        rows={loaded}
        rowKey={(estimate) => estimate.id}
        onRowClick={(estimate) => setDetailId(estimate.id)}
        loading={estimates.isPending}
        toolbar={
          <PageToolbar
            start={
              <CountTabs
                label="Estimate statuses"
                items={TABS.map((item) => ({ ...item, count: tabCount(item.value) }))}
                value={tab}
                onChange={(value) => setParam({ tab: value === 'all' ? null : value })}
              />
            }
            search={
              <SearchField
                label="Search estimates"
                placeholder="Search number, reference or client"
                value={searchText}
                onChange={setSearchText}
              />
            }
            actions={
              canPickClient ? (
                <FilterPopover
                  title="Filter estimates"
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
                  leftIcon={<FilePlus2 aria-hidden="true" className="size-4" />}
                  onClick={() => setForm({ mode: 'new' })}
                >
                  New estimate
                </Button>
              ) : undefined
            }
          />
        }
        empty={
          filtered ? (
            <EmptyState
              icon={<SearchX className="size-6" />}
              title="No estimates match"
              description="Try a different search, status or client."
              action={<Button onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              icon={<FileSignature className="size-6" />}
              title="No estimates yet"
              description="An estimate prices work before it starts. Send it, record the client's answer, then convert an accepted one into a draft invoice."
              action={newButton}
            />
          )
        }
        footer={
          loaded.length > 0 ? (
            <div className="border-t border-row-border px-4 py-2">
              <Pagination
                hasMore={estimates.hasNextPage}
                onLoadMore={() => void estimates.fetchNextPage()}
                loading={estimates.isFetchingNextPage}
                count={loaded.length}
                itemLabel={['estimate', 'estimates']}
              />
            </div>
          ) : null
        }
      />
      <EstimateDetailDialog
        key={detailId ?? 'none'}
        estimateId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={(estimate) => {
          setDetailId(null);
          setForm({ mode: 'edit', estimate });
        }}
      />
      {form ? (
        <EstimateFormDialog
          open
          estimate={form.mode === 'edit' ? form.estimate : null}
          onClose={() => {
            // Leaving the edit goes back to the estimate it started from.
            if (form.mode === 'edit') setDetailId(form.estimate.id);
            setForm(null);
          }}
          onSaved={(estimate) => {
            setForm(null);
            setDetailId(estimate.id);
          }}
        />
      ) : null}
    </>
  );
}

/** `/:orgSlug/billing/estimates`: estimates to send, answer and convert (`estimate.read`). */
export default function EstimatesPage() {
  const { can } = useOrg();
  useDocumentTitle('Estimates');
  return (
    <PageShell
      title="Estimates"
      description="Price work before it starts. Send an estimate, record the client's answer and convert it into a draft invoice."
    >
      {can(P.estimateRead) ? <EstimateList /> : <NoAccess what="estimates" />}
    </PageShell>
  );
}
