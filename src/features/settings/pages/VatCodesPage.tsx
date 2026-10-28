import { Info, Percent, Plus, SearchX } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import {
  Badge,
  Button,
  Card,
  ColumnVisibilityMenu,
  ConfirmDialog,
  CountTabs,
  DataTable,
  EmptyState,
  PageToolbar,
  SearchField,
  sortRows,
  useToast,
  type DataTableColumn,
  type DataTableSort,
  type DropdownItem,
  RowActions,
} from '@/components/ui';
import { ORG_SEGMENTS, modulePath } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle, usePersistentColumns, useUrlParams } from '@/hooks';
import { formatBasisPoints } from '@/utils/money';

import { useDeleteVatRate, useUpdateVatRate, useVatRates } from '../api/billingHooks';
import type { VatRate, VatRateUpdate } from '../billingTypes';
import { LoadError } from '../components/LoadError';
import { SettingsSection } from '../components/SettingsSection';
import { VatRateFormPanel } from '../components/vat/VatRateFormPanel';
import { useUrlSearch } from '../hooks/useUrlSearch';
import { dialogError } from '../utils/billingErrors';
import { describeError } from '../utils/errors';
import { VAT_CODE_LABEL, VAT_CODE_TONE } from '../utils/vat';

type VatTab = 'all' | 'active' | 'archived';
const TABS: ReadonlyArray<{ value: VatTab; label: string }> = [
  { value: 'all', label: 'All VAT codes' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];
const SORTS = ['name', 'code', 'rate', 'status'] as const;

type DialogState =
  | { type: 'form'; rate: VatRate | null }
  | { type: 'archive'; rateId: string }
  | { type: 'delete'; rateId: string }
  | null;

function VatCodeList() {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const { params, setParam } = useUrlParams();
  const { text: searchText, setText: setSearchText, searched } = useUrlSearch();

  const tabParam = params.get('tab');
  const tab: VatTab = TABS.find((item) => item.value === tabParam)?.value ?? 'all';
  const sortId = SORTS.find((item) => item === params.get('sort'));
  const order = params.get('order') === 'desc' ? 'desc' : 'asc';
  const canManage = can(PERMISSIONS.settingsManage);

  const rates = useVatRates();
  const update = useUpdateVatRate();
  const remove = useDeleteVatRate();

  const [hidden, setHidden] = usePersistentColumns('vat-codes');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const close = () => setDialog(null);

  const all = rates.data ?? [];
  const target =
    dialog && dialog.type !== 'form'
      ? (all.find((rate) => rate.id === dialog.rateId) ?? null)
      : null;

  const change = (rate: VatRate, body: VatRateUpdate, done: string) => {
    update.mutate(
      { rateId: rate.id, body },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: done });
          close();
        },
        onError: (error) => {
          if (dialog?.type === 'archive') setRefusal(dialogError(error));
          else toast({ tone: 'error', ...describeError(error, 'Could not change the VAT code') });
        },
      },
    );
  };

  const confirmArchive = () => {
    if (target) change(target, { is_archived: true }, `${target.name} archived`);
  };

  const confirmDelete = () => {
    if (!target) return;
    remove.mutate(target.id, {
      onSuccess: (result) => {
        toast({
          tone: 'success',
          title:
            result.outcome === 'deleted'
              ? `${target.name} deleted`
              : target.is_archived
                ? `${target.name} is in use and stays archived`
                : `${target.name} archived instead`,
          description:
            result.outcome === 'deleted'
              ? undefined
              : 'A service, activity type, client, expense or invoice line uses it, so it was kept.',
        });
        close();
      },
      onError: (error) => setRefusal(dialogError(error)),
    });
  };

  const actionsFor = (rate: VatRate): DropdownItem[] => {
    const destructive: DropdownItem[] = [
      { id: 'separator', separator: true },
      {
        id: 'delete',
        label: 'Delete',
        tone: 'danger',
        onSelect: () => {
          setRefusal(null);
          setDialog({ type: 'delete', rateId: rate.id });
        },
      },
    ];
    if (rate.is_archived) {
      return [
        {
          id: 'restore',
          label: 'Restore',
          onSelect: () => change(rate, { is_archived: false }, `${rate.name} restored`),
        },
        ...destructive,
      ];
    }
    return [
      { id: 'edit', label: 'Edit', onSelect: () => setDialog({ type: 'form', rate }) },
      ...(rate.is_default
        ? []
        : [
            {
              id: 'default',
              label: 'Make default',
              onSelect: () =>
                change(rate, { is_default: true }, `${rate.name} is now the default VAT code`),
            },
          ]),
      {
        id: 'archive',
        label: 'Archive',
        onSelect: () => {
          setRefusal(null);
          setDialog({ type: 'archive', rateId: rate.id });
        },
      },
      ...destructive,
    ];
  };

  const columns: DataTableColumn<VatRate>[] = [
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      sortValue: (rate) => rate.name,
      hideable: false,
      cell: (rate) => <span className="font-semibold text-text">{rate.name}</span>,
    },
    {
      id: 'code',
      header: 'Code',
      sortable: true,
      sortValue: (rate) => VAT_CODE_LABEL[rate.code],
      className: 'w-40 whitespace-nowrap',
      cell: (rate) => (
        <Badge tone={VAT_CODE_TONE[rate.code]} size="sm">
          {VAT_CODE_LABEL[rate.code]}
        </Badge>
      ),
    },
    {
      id: 'rate',
      header: 'Rate',
      sortable: true,
      sortValue: (rate) => rate.rate_bp,
      align: 'end',
      className: 'w-28 whitespace-nowrap',
      cell: (rate) => <span className="tabular-nums">{formatBasisPoints(rate.rate_bp)}</span>,
    },
    {
      id: 'default',
      header: 'Default',
      className: 'w-28 whitespace-nowrap',
      cell: (rate) =>
        rate.is_default ? (
          <Badge tone="violet" size="sm">
            Default
          </Badge>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (rate) => (rate.is_archived ? 'Archived' : 'Active'),
      className: 'w-28',
      cell: (rate) => (
        <Badge tone={rate.is_archived ? 'neutral' : 'success'}>
          {rate.is_archived ? 'Archived' : 'Active'}
        </Badge>
      ),
    },
  ];

  const needle = searched.toLowerCase();
  const matches = all.filter(
    (rate) =>
      (tab === 'all' || rate.is_archived === (tab === 'archived')) &&
      (needle === '' ||
        rate.name.toLowerCase().includes(needle) ||
        VAT_CODE_LABEL[rate.code].toLowerCase().includes(needle) ||
        formatBasisPoints(rate.rate_bp).includes(needle)),
  );
  const sort: DataTableSort | null = sortId ? { columnId: sortId, direction: order } : null;
  const rows = sortRows(matches, columns, sort);
  const counts: Record<VatTab, number> = {
    all: all.length,
    active: all.filter((rate) => !rate.is_archived).length,
    archived: all.filter((rate) => rate.is_archived).length,
  };
  const filtered = needle !== '' || tab !== 'all';

  if (rates.isError && !rates.data) {
    return (
      <LoadError
        title="Could not load the VAT codes"
        error={rates.error}
        onRetry={() => void rates.refetch()}
        retrying={rates.isRefetching}
      />
    );
  }

  return (
    <>
      <VatRateFormPanel
        open={dialog?.type === 'form'}
        rate={dialog?.type === 'form' ? dialog.rate : null}
        onClose={close}
      />
      {organization.vat_registered ? null : (
        <Card padding="sm" className="flex items-start gap-3 text-xs text-text-muted">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
          <p>
            This practice is not VAT registered, so every invoice line carries 0% VAT whatever its
            VAT code.{' '}
            <Link
              to={modulePath(organization.slug, ORG_SEGMENTS.settings, 'practice')}
              className="font-medium text-brand-text hover:underline"
            >
              Change this in Practice Settings
            </Link>
            .
          </p>
        </Card>
      )}
      <DataTable
        caption="VAT codes"
        columns={columns}
        rows={rows}
        rowKey={(rate) => rate.id}
        sort={sort}
        onSortChange={(next) => setParam({ sort: next.columnId, order: next.direction })}
        hiddenColumns={hidden}
        loading={rates.isPending}
        toolbar={
          <PageToolbar
            start={
              <CountTabs
                label="VAT code lists"
                items={TABS.map((item) => ({
                  ...item,
                  count: rates.data ? counts[item.value] : null,
                }))}
                value={tab}
                onChange={(value) => setParam({ tab: value === 'all' ? null : value })}
              />
            }
            search={
              <SearchField
                label="Search VAT codes"
                placeholder="Quick search"
                value={searchText}
                onChange={setSearchText}
              />
            }
            actions={
              <ColumnVisibilityMenu
                columns={columns.map((column) => ({
                  id: column.id,
                  label: column.header,
                  locked: column.hideable === false,
                }))}
                hidden={hidden}
                onChange={setHidden}
              />
            }
            primaryAction={
              canManage ? (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus aria-hidden="true" className="size-4" />}
                  onClick={() => setDialog({ type: 'form', rate: null })}
                >
                  Add VAT code
                </Button>
              ) : undefined
            }
          />
        }
        rowActions={
          canManage
            ? (rate) => <RowActions label={`Actions for ${rate.name}`} items={actionsFor(rate)} />
            : undefined
        }
        empty={
          filtered ? (
            <EmptyState
              icon={<SearchX className="size-6" />}
              title="No VAT codes match"
              description="Try a different search or another tab."
              action={
                <Button
                  onClick={() => {
                    setSearchText('');
                    setParam({ q: null, tab: null });
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Percent className="size-6" />}
              title="No VAT codes yet"
              description="VAT codes say how much VAT an invoice line carries. Add the ones the practice charges."
              action={
                canManage ? (
                  <Button variant="primary" onClick={() => setDialog({ type: 'form', rate: null })}>
                    Add VAT code
                  </Button>
                ) : undefined
              }
            />
          )
        }
        footer={
          rows.length > 0 ? (
            <p className="border-t border-row-border px-4 py-3 text-sm text-text-muted">
              Showing {rows.length} of {all.length} {all.length === 1 ? 'VAT code' : 'VAT codes'}
              {canManage ? null : '. Changing VAT codes needs permission to manage settings.'}
            </p>
          ) : null
        }
      />
      <ConfirmDialog
        open={dialog?.type === 'archive' && target !== null}
        onClose={close}
        onConfirm={confirmArchive}
        title="Archive VAT code?"
        confirmLabel="Archive"
        tone="default"
        loading={update.isPending}
        error={refusal}
      >
        <p>
          <strong className="font-medium text-text">{target?.name}</strong> will no longer be
          offered when a VAT code is chosen. Invoices, services and clients that already use it keep
          it, and you can restore it later.
        </p>
        {target?.is_default ? (
          <p>It is the default VAT code: the practice will have no default until you choose one.</p>
        ) : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog?.type === 'delete' && target !== null}
        onClose={close}
        onConfirm={confirmDelete}
        title="Delete VAT code?"
        confirmLabel="Delete"
        loading={remove.isPending}
        error={refusal}
      >
        <p>
          <strong className="font-medium text-text">{target?.name}</strong> is removed completely
          when nothing uses it. If a service, activity type, client, expense or invoice line uses
          it, it is archived instead, so what already uses it keeps its VAT.
        </p>
        {target?.is_default ? (
          <p>It is the default VAT code: the practice will have no default until you choose one.</p>
        ) : null}
      </ConfirmDialog>
    </>
  );
}

/**
 * `/:orgSlug/settings/vat-codes`: the VAT codes of invoice lines, services and expenses. Any
 * member reads them; `settings.manage` adds, changes, archives and deletes.
 */
export default function VatCodesPage() {
  useDocumentTitle('VAT codes');
  return (
    <SettingsSection
      title="VAT Codes"
      description="The VAT treatments and rates that invoice lines, services and expenses use. An issued invoice keeps the rate it was issued with, so changing a rate never alters it."
    >
      <VatCodeList />
    </SettingsSection>
  );
}
