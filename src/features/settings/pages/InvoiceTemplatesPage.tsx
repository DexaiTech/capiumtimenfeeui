import { Ellipsis, FileText, Plus, SearchX } from 'lucide-react';
import { useState } from 'react';

import {
  Badge,
  Button,
  Card,
  ColumnVisibilityMenu,
  ConfirmDialog,
  CountTabs,
  DataTable,
  Dropdown,
  EmptyState,
  PageToolbar,
  SearchField,
  sortRows,
  useToast,
  type DataTableColumn,
  type DataTableSort,
  type DropdownItem,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle, useUrlParams } from '@/hooks';

import {
  useDeleteInvoiceTemplate,
  useInvoiceTemplates,
  useMakeDefaultInvoiceTemplate,
  useUpdateInvoiceTemplate,
} from '../api/billingHooks';
import type { InvoiceTemplate, InvoiceTemplateStatus } from '../billingTypes';
import { InvoiceTemplateFormDialog } from '../components/templates/InvoiceTemplateFormDialog';
import { LoadError } from '../components/LoadError';
import { SettingsSection } from '../components/SettingsSection';
import { useUrlSearch } from '../hooks/useUrlSearch';
import { dialogError } from '../utils/billingErrors';
import { describeError } from '../utils/errors';
import { LAYOUT_LABEL } from '../utils/templates';

type TemplateTab = 'all' | 'active' | 'inactive';
const TABS: ReadonlyArray<{ value: TemplateTab; label: string }> = [
  { value: 'all', label: 'All templates' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];
const SORTS = ['name', 'layout', 'used', 'status'] as const;

type DialogState =
  | { type: 'form'; template: InvoiceTemplate | null; readOnly: boolean }
  | { type: 'remove'; templateId: string }
  | null;

const clients = (count: number) => (count === 1 ? '1 client' : `${count} clients`);

function TemplateList() {
  const { can } = useOrg();
  const { toast } = useToast();
  const { params, setParam } = useUrlParams();
  const { text: searchText, setText: setSearchText, searched } = useUrlSearch();

  const canManage = can(PERMISSIONS.settingsManage);
  const tabs = canManage ? TABS : TABS.slice(0, 1);
  const tabParam = params.get('tab');
  const tab: TemplateTab = tabs.find((item) => item.value === tabParam)?.value ?? 'all';
  const sortId = SORTS.find((item) => item === params.get('sort'));
  const order = params.get('order') === 'desc' ? 'desc' : 'asc';

  // The inactive templates are only listed to people who manage settings.
  const templates = useInvoiceTemplates({ includeInactive: canManage });
  const update = useUpdateInvoiceTemplate();
  const makeDefault = useMakeDefaultInvoiceTemplate();
  const remove = useDeleteInvoiceTemplate();

  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const close = () => setDialog(null);

  const all = templates.data ?? [];
  const target =
    dialog?.type === 'remove'
      ? (all.find((template) => template.id === dialog.templateId) ?? null)
      : null;

  const setStatus = (template: InvoiceTemplate, status: InvoiceTemplateStatus) => {
    update.mutate(
      { templateId: template.id, body: { status } },
      {
        onSuccess: () => {
          toast({
            tone: 'success',
            title:
              status === 'active' ? `${template.name} activated` : `${template.name} deactivated`,
          });
          close();
        },
        onError: (error) => {
          if (dialog?.type === 'remove') setRefusal(dialogError(error));
          else toast({ tone: 'error', ...describeError(error, 'Could not change the template') });
        },
      },
    );
  };

  const setDefault = (template: InvoiceTemplate) => {
    makeDefault.mutate(template.id, {
      onSuccess: () =>
        toast({ tone: 'success', title: `${template.name} is now the default template` }),
      onError: (error) =>
        toast({ tone: 'error', ...describeError(error, 'Could not change the default template') }),
    });
  };

  const confirmRemove = () => {
    if (!target) return;
    // A template clients use cannot be deleted: it is deactivated instead.
    if (target.client_count > 0) {
      setStatus(target, 'inactive');
      return;
    }
    remove.mutate(target.id, {
      onSuccess: () => {
        toast({ tone: 'success', title: `${target.name} deleted` });
        close();
      },
      onError: (error) => setRefusal(dialogError(error)),
    });
  };

  const actionsFor = (template: InvoiceTemplate): DropdownItem[] => {
    if (!canManage) {
      return [
        {
          id: 'preview',
          label: 'Preview',
          onSelect: () => setDialog({ type: 'form', template, readOnly: true }),
        },
      ];
    }
    const active = template.status === 'active';
    return [
      {
        id: 'edit',
        label: 'Edit',
        onSelect: () => setDialog({ type: 'form', template, readOnly: false }),
      },
      ...(active && !template.is_default
        ? [{ id: 'default', label: 'Make default', onSelect: () => setDefault(template) }]
        : []),
      {
        id: 'toggle',
        label: active ? 'Deactivate' : 'Activate',
        // The default template is what clients without one use: it stays active.
        disabled: template.is_default,
        onSelect: () => setStatus(template, active ? 'inactive' : 'active'),
      },
      { id: 'separator', separator: true },
      {
        id: 'delete',
        label: 'Delete',
        tone: 'danger',
        disabled: template.is_default,
        onSelect: () => {
          setRefusal(null);
          setDialog({ type: 'remove', templateId: template.id });
        },
      },
    ];
  };

  const columns: DataTableColumn<InvoiceTemplate>[] = [
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      sortValue: (template) => template.name,
      hideable: false,
      cell: (template) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-semibold text-text">{template.name}</span>
          {template.is_default ? (
            <Badge tone="violet" size="sm">
              Default
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      id: 'layout',
      header: 'Layout',
      sortable: true,
      sortValue: (template) => LAYOUT_LABEL[template.layout],
      className: 'w-32 whitespace-nowrap',
      cell: (template) => <span className="text-text">{LAYOUT_LABEL[template.layout]}</span>,
    },
    {
      id: 'logo',
      header: 'Logo',
      className: 'w-24 whitespace-nowrap',
      cell: (template) => (
        <span className={template.show_logo ? 'text-text' : 'text-text-muted'}>
          {template.show_logo ? 'Shown' : 'Hidden'}
        </span>
      ),
    },
    {
      id: 'bank',
      header: 'Bank details',
      className: 'w-32 whitespace-nowrap',
      cell: (template) => (
        <span className={template.show_bank_details ? 'text-text' : 'text-text-muted'}>
          {template.show_bank_details ? 'Shown' : 'Hidden'}
        </span>
      ),
    },
    {
      id: 'footer',
      header: 'Footer',
      className: 'min-w-40 max-w-64',
      cell: (template) =>
        template.footer_text ? (
          <span className="line-clamp-2 text-text" title={template.footer_text}>
            {template.footer_text}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      id: 'used',
      header: 'Used by',
      sortable: true,
      sortValue: (template) => template.client_count,
      className: 'w-32 whitespace-nowrap',
      cell: (template) =>
        template.client_count === 0 ? (
          <span className="text-text-muted">No clients</span>
        ) : (
          <span className="text-text">{clients(template.client_count)}</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (template) => (template.status === 'active' ? 'Active' : 'Inactive'),
      className: 'w-28',
      cell: (template) => (
        <Badge tone={template.status === 'active' ? 'success' : 'neutral'}>
          {template.status === 'active' ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  const needle = searched.toLowerCase();
  const matches = all.filter(
    (template) =>
      (tab === 'all' || template.status === tab) &&
      (needle === '' ||
        [template.name, LAYOUT_LABEL[template.layout], template.footer_text].some((text) =>
          text?.toLowerCase().includes(needle),
        )),
  );
  const sort: DataTableSort | null = sortId ? { columnId: sortId, direction: order } : null;
  const rows = sortRows(matches, columns, sort);
  const counts: Record<TemplateTab, number> = {
    all: all.length,
    active: all.filter((template) => template.status === 'active').length,
    inactive: all.filter((template) => template.status === 'inactive').length,
  };
  const filtered = needle !== '' || tab !== 'all';

  if (templates.isError && !templates.data) {
    return (
      <LoadError
        title="Could not load the invoice templates"
        error={templates.error}
        onRetry={() => void templates.refetch()}
        retrying={templates.isRefetching}
      />
    );
  }

  const used = target !== null && target.client_count > 0;

  return (
    <>
      <DataTable
        caption="Invoice templates"
        columns={columns}
        rows={rows}
        rowKey={(template) => template.id}
        sort={sort}
        onSortChange={(next) => setParam({ sort: next.columnId, order: next.direction })}
        hiddenColumns={hidden}
        loading={templates.isPending}
        toolbar={
          <PageToolbar
            start={
              <CountTabs
                label="Template lists"
                items={tabs.map((item) => ({
                  ...item,
                  count: templates.data ? counts[item.value] : null,
                }))}
                value={tab}
                onChange={(value) => setParam({ tab: value === 'all' ? null : value })}
              />
            }
            search={
              <SearchField
                label="Search templates"
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
                  onClick={() => setDialog({ type: 'form', template: null, readOnly: false })}
                >
                  Add template
                </Button>
              ) : undefined
            }
          />
        }
        rowActions={(template) => (
          <Dropdown
            label={`Actions for ${template.name}`}
            items={actionsFor(template)}
            trigger={<Ellipsis aria-hidden="true" className="size-5 text-text-muted" />}
          />
        )}
        empty={
          filtered ? (
            <EmptyState
              icon={<SearchX className="size-6" />}
              title="No templates match"
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
              icon={<FileText className="size-6" />}
              title="No invoice templates yet"
              description="A template sets how an invoice looks: the layout of its lines, the logo, the bank details and the footer."
              action={
                canManage ? (
                  <Button
                    variant="primary"
                    onClick={() => setDialog({ type: 'form', template: null, readOnly: false })}
                  >
                    Add template
                  </Button>
                ) : undefined
              }
            />
          )
        }
        footer={
          rows.length > 0 ? (
            <p className="border-t border-row-border px-4 py-3 text-sm text-text-muted">
              Showing {rows.length} of {all.length} {all.length === 1 ? 'template' : 'templates'}
              {canManage ? null : '. Changing templates needs permission to manage settings.'}
            </p>
          ) : null
        }
      />
      <Card padding="md" className="flex flex-col gap-1.5">
        <h2 className="text-sm font-semibold text-text">Which template an invoice uses</h2>
        <p className="text-xs text-text-muted">
          A client uses the template chosen in its billing settings, or the default template when it
          has none. The default template cannot be deactivated or deleted: make another template the
          default first. A template that clients use can be deactivated but not deleted; those
          clients keep it.
        </p>
        <p className="text-xs text-text-muted">
          The PDF renderer will apply the templates when issued invoices are drawn. Until it does,
          invoice PDFs still use the practice letterhead and footer.
        </p>
      </Card>
      <InvoiceTemplateFormDialog
        open={dialog?.type === 'form'}
        template={dialog?.type === 'form' ? dialog.template : null}
        readOnly={dialog?.type === 'form' ? dialog.readOnly : false}
        onClose={close}
      />
      <ConfirmDialog
        open={target !== null}
        onClose={close}
        onConfirm={confirmRemove}
        title={used ? 'Deactivate template?' : 'Delete template?'}
        confirmLabel={used ? 'Deactivate' : 'Delete'}
        tone={used ? 'default' : 'danger'}
        loading={remove.isPending || update.isPending}
        error={refusal}
      >
        {used ? (
          <p>
            <strong className="font-medium text-text">{target.name}</strong> is used by{' '}
            {clients(target.client_count)}, so it cannot be deleted. It will be deactivated instead:
            those clients keep it, and it is no longer offered when a template is chosen.
          </p>
        ) : (
          <p>
            <strong className="font-medium text-text">{target?.name}</strong> is not used by any
            client, so it will be removed. Its name can be used again.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}

/**
 * `/:orgSlug/settings/invoice-templates`: the invoice templates of the practice and a preview
 * of each. Any member reads the active ones; `settings.manage` adds, changes, activates,
 * deactivates, deletes and chooses the default.
 */
export default function InvoiceTemplatesPage() {
  useDocumentTitle('Invoice templates');
  return (
    <SettingsSection
      title="Invoice Templates"
      description="The layout, logo, bank details and footer of your invoices. Each client uses one template; the default covers the rest."
    >
      <TemplateList />
    </SettingsSection>
  );
}
