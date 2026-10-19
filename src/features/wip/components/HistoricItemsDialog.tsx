import { ClipboardList } from 'lucide-react';

import { DataTable, EmptyState, Modal, Pagination } from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { formatUkDate } from '@/utils/dates';

import { flattenPages, useHistoricItems } from '../api';
import type { HistoricItemFilters } from '../types';
import { historicItemColumns } from './historicColumns';
import { LoadError } from './PageShell';

function ItemsTable({ filters }: { filters: HistoricItemFilters }) {
  const { organization, can } = useOrg();
  const list = useHistoricItems(filters);
  const rows = flattenPages(list.data);
  const columns = historicItemColumns({
    slug: organization.slug,
    currency: organization.currency,
    canOpenJob: can(PERMISSIONS.jobRead),
    jobHref: (jobId) => routes.org.job(organization.slug, jobId),
  });

  if (list.isError && !list.data) {
    return (
      <LoadError
        title="Could not load the items"
        error={list.error}
        onRetry={() => void list.refetch()}
        retrying={list.isRefetching}
      />
    );
  }
  return (
    <DataTable
      caption="Items behind the WIP report"
      columns={columns}
      rows={rows}
      rowKey={(item) => `${item.kind}:${item.id}`}
      loading={list.isPending}
      empty={
        <EmptyState
          icon={<ClipboardList className="size-6" />}
          title="No items"
          description="Nothing was in the WIP for this row on that day."
        />
      }
      footer={
        rows.length > 0 ? (
          <div className="border-t border-row-border px-4 py-3">
            <Pagination
              hasMore={list.hasNextPage}
              onLoadMore={() => void list.fetchNextPage()}
              loading={list.isFetchingNextPage}
              count={rows.length}
              itemLabel={['item', 'items']}
            />
          </div>
        ) : undefined
      }
    />
  );
}

export interface HistoricItemsDialogProps {
  /** What the items are the items of ("Acme Ltd"); the dialog is closed while this is null. */
  title: string | null;
  filters: HistoricItemFilters | null;
  onClose: () => void;
}

/** The items behind one row of the historic report, as they stood at the day. */
export function HistoricItemsDialog({ title, filters, onClose }: HistoricItemsDialogProps) {
  return (
    <Modal
      open={title !== null && filters !== null}
      onClose={onClose}
      title="Items behind the figures"
      description={filters ? `${title ?? ''}, as at ${formatUkDate(filters.as_at)}` : undefined}
      size="lg"
    >
      {filters ? <ItemsTable filters={filters} /> : null}
    </Modal>
  );
}
