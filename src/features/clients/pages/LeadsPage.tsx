import { ArrowLeft, SearchX, Target, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { PageHeader } from '@/components/layout';
import {
  Badge,
  Button,
  buttonClasses,
  Card,
  ConfirmDialog,
  CountTabs,
  DataTable,
  EmptyState,
  ErrorState,
  PageToolbar,
  Pagination,
  RowActions,
  SearchField,
  useToast,
  type ConfirmDialogError,
  type DataTableColumn,
  type DropdownItem,
} from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { useDebouncedValue, useDocumentTitle, useUrlParams } from '@/hooks';
import { isApiError } from '@/services/api';
import { formatDayMonthYear } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import {
  flattenPages,
  useArchiveLead,
  useConvertLead,
  useLeadList,
  useLeadSummary,
} from '../api';
import { CLIENT_TYPE_LABELS } from '../constants';
import { LeadFormPanel } from '../leads/LeadFormPanel';
import { LEAD_STATUSES, type Lead, type LeadStatus } from '../leads/types';

const TABS: ReadonlyArray<{ value: LeadStatus; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'converted', label: 'Converted' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_BADGE: Record<LeadStatus, { label: string; tone: 'info' | 'success' | 'neutral' }> =
  {
    open: { label: 'Open', tone: 'info' },
    converted: { label: 'Converted', tone: 'success' },
    archived: { label: 'Archived', tone: 'neutral' },
  };

type DialogState =
  | { type: 'form'; lead: Lead | null }
  | { type: 'convert'; lead: Lead }
  | { type: 'archive'; lead: Lead }
  | null;

/** A refusal shown in a confirmation dialog, with the request id. */
function refusalOf(error: unknown): ConfirmDialogError {
  if (isApiError(error)) return { message: error.message, requestId: error.requestId };
  return { message: 'An unexpected error occurred. Please try again.' };
}

function LeadList() {
  const { organization, can } = useOrg();
  const currency = organization.currency;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { params, setParam } = useUrlParams();
  const [search, setSearch] = useState('');
  const searched = useDebouncedValue(search.trim());

  const tabParam = params.get('tab');
  const tab: LeadStatus = LEAD_STATUSES.find((value) => value === tabParam) ?? 'open';
  const canCreate = can(P.clientCreate);
  const canUpdate = can(P.clientUpdate);
  const canArchive = can(P.clientDelete);

  const listParams = useMemo(() => ({ status: tab, q: searched }), [tab, searched]);
  const leads = useLeadList(listParams);
  const summary = useLeadSummary();
  const loaded = useMemo(() => flattenPages(leads.data), [leads.data]);
  const convert = useConvertLead();
  const archive = useArchiveLead();

  const [dialog, setDialog] = useState<DialogState>(null);
  const [refusal, setRefusal] = useState<ConfirmDialogError | null>(null);
  const close = () => {
    setDialog(null);
    setRefusal(null);
  };

  const clientHref = (clientId: string) => routes.org.client(organization.slug, clientId);

  const confirmConvert = () => {
    if (dialog?.type !== 'convert') return;
    const { lead } = dialog;
    convert.mutate(
      { leadId: lead.id },
      {
        onSuccess: (converted) => {
          const client = converted.converted_client;
          toast({
            tone: 'success',
            title: `${lead.name} is now a client`,
            description: client ? `Client ${client.code} was created.` : undefined,
            action: client
              ? { label: 'Open client', onClick: () => void navigate(clientHref(client.id)) }
              : undefined,
          });
          close();
        },
        onError: (error) => setRefusal(refusalOf(error)),
      },
    );
  };

  const setArchived = (lead: Lead, archived: boolean, onDone?: () => void) => {
    archive.mutate(
      { leadId: lead.id, archived },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: `${lead.name} ${archived ? 'archived' : 'unarchived'}` });
          onDone?.();
        },
        onError: (error) =>
          archived
            ? setRefusal(refusalOf(error))
            : toast({
                tone: 'error',
                title: 'Could not unarchive the lead',
                description: refusalOf(error).message,
              }),
      },
    );
  };

  const actionsFor = (lead: Lead): DropdownItem[] => {
    const items: DropdownItem[] = [];
    if (lead.converted_client) {
      const client = lead.converted_client;
      items.push({
        id: 'view-client',
        label: 'Open client',
        onSelect: () => void navigate(clientHref(client.id)),
      });
    }
    if (canUpdate) {
      items.push({ id: 'edit', label: 'Edit', onSelect: () => setDialog({ type: 'form', lead }) });
    }
    if (canCreate && lead.status === 'open') {
      items.push({
        id: 'convert',
        label: 'Convert to client',
        onSelect: () => {
          setRefusal(null);
          setDialog({ type: 'convert', lead });
        },
      });
    }
    if (canArchive) {
      items.push(
        lead.status === 'archived'
          ? { id: 'unarchive', label: 'Unarchive', onSelect: () => setArchived(lead, false) }
          : {
              id: 'archive',
              label: 'Archive',
              onSelect: () => {
                setRefusal(null);
                setDialog({ type: 'archive', lead });
              },
            },
      );
    }
    return items;
  };

  const columns: DataTableColumn<Lead>[] = [
    {
      id: 'name',
      header: 'Lead',
      hideable: false,
      plain: true,
      cell: (lead) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-semibold text-text">{lead.name}</span>
          <span className="text-xs text-text-muted">
            {[lead.contact_name, lead.email, lead.phone].filter(Boolean).join(' · ') ||
              CLIENT_TYPE_LABELS[lead.client_type]}
          </span>
        </div>
      ),
    },
    {
      id: 'source',
      header: 'Source',
      plain: true,
      className: 'whitespace-nowrap',
      cell: (lead) => lead.source ?? <span className="text-text-subtle">—</span>,
    },
    {
      id: 'acquisition',
      header: 'Acquisition',
      align: 'end',
      plain: true,
      className: 'w-32 whitespace-nowrap tabular-nums',
      cell: (lead) => formatMoney(lead.acquisition_cost, currency),
    },
    {
      id: 'onboarding',
      header: 'Onboarding',
      align: 'end',
      plain: true,
      className: 'w-32 whitespace-nowrap tabular-nums',
      cell: (lead) => formatMoney(lead.onboarding_cost, currency),
    },
    {
      id: 'total',
      header: 'Total cost',
      align: 'end',
      plain: true,
      className: 'w-32 whitespace-nowrap tabular-nums',
      cell: (lead) => (
        <span className="font-semibold text-text">{formatMoney(lead.total_cost, currency)}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      plain: true,
      className: 'whitespace-nowrap',
      cell: (lead) => (
        <div className="flex flex-col items-start gap-1">
          <Badge tone={STATUS_BADGE[lead.status].tone}>{STATUS_BADGE[lead.status].label}</Badge>
          {lead.converted_client ? (
            <Link
              to={clientHref(lead.converted_client.id)}
              className="text-xs font-medium text-brand-text hover:underline"
            >
              {lead.converted_client.code} · {lead.converted_client.name}
            </Link>
          ) : null}
        </div>
      ),
    },
    {
      id: 'added',
      header: 'Added',
      plain: true,
      className: 'w-28 whitespace-nowrap',
      cell: (lead) => formatDayMonthYear(lead.created_at, organization.timezone),
    },
  ];

  const totals = summary.data?.[tab];
  const filtered = searched !== '';

  if (leads.isError && !leads.data) {
    return (
      <div className="rounded-xl border border-border bg-surface shadow-card">
        <ErrorState
          title="Could not load the leads"
          error={isApiError(leads.error) ? leads.error : null}
          onRetry={() => void leads.refetch()}
          retrying={leads.isRefetching}
        />
      </div>
    );
  }

  const target = dialog?.type === 'convert' || dialog?.type === 'archive' ? dialog.lead : null;

  return (
    <>
      <LeadFormPanel
        open={dialog?.type === 'form'}
        lead={dialog?.type === 'form' ? dialog.lead : null}
        onClose={close}
      />
      <dl aria-label="Lead totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: `${STATUS_BADGE[tab].label} leads`,
            value: totals ? String(totals.count) : '–',
          },
          {
            label: 'Acquisition cost',
            value: totals ? formatMoney(totals.acquisition_cost, currency) : '–',
          },
          {
            label: 'Onboarding cost',
            value: totals ? formatMoney(totals.onboarding_cost, currency) : '–',
          },
          { label: 'Total cost', value: totals ? formatMoney(totals.total_cost, currency) : '–' },
        ].map((stat) => (
          <Card key={stat.label} padding="sm" className="flex flex-col gap-1">
            <dt className="text-xs text-text-muted">{stat.label}</dt>
            <dd className="text-xl font-semibold tabular-nums text-text">{stat.value}</dd>
          </Card>
        ))}
      </dl>
      <DataTable
        caption="Leads"
        columns={columns}
        rows={loaded}
        rowKey={(lead) => lead.id}
        loading={leads.isPending}
        toolbar={
          <PageToolbar
            start={
              <CountTabs
                label="Lead lists"
                items={TABS.map((item) => ({
                  ...item,
                  count: summary.data ? summary.data[item.value].count : null,
                }))}
                value={tab}
                onChange={(value) => setParam({ tab: value === 'open' ? null : value })}
              />
            }
            search={
              <SearchField
                label="Search leads"
                placeholder="Search name, contact or email"
                value={search}
                onChange={setSearch}
              />
            }
            primaryAction={
              canCreate ? (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<UserPlus aria-hidden="true" className="size-4" />}
                  onClick={() => setDialog({ type: 'form', lead: null })}
                >
                  Add lead
                </Button>
              ) : undefined
            }
          />
        }
        rowActions={(lead) => {
          const items = actionsFor(lead);
          return items.length > 0 ? (
            <RowActions label={`Actions for ${lead.name}`} items={items} />
          ) : null;
        }}
        empty={
          filtered ? (
            <EmptyState
              icon={<SearchX className="size-6" />}
              title="No leads match"
              description="Try a different search or another tab."
              action={<Button onClick={() => setSearch('')}>Clear search</Button>}
            />
          ) : (
            <EmptyState
              icon={<Target className="size-6" />}
              title={tab === 'open' ? 'No open leads' : `No ${tab} leads`}
              description={
                tab === 'open'
                  ? 'Add the prospective clients you are pursuing, with what winning them costs. Convert a lead into a client in one click once it is won.'
                  : tab === 'converted'
                    ? 'Leads you convert into clients are listed here, linked to their client.'
                    : 'Archived leads are kept here; unarchive one to pick it up again.'
              }
              action={
                canCreate && tab === 'open' ? (
                  <Button
                    variant="primary"
                    onClick={() => setDialog({ type: 'form', lead: null })}
                  >
                    Add lead
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
                hasMore={leads.hasNextPage}
                onLoadMore={() => void leads.fetchNextPage()}
                loading={leads.isFetchingNextPage}
                count={loaded.length}
                itemLabel={['lead', 'leads']}
              />
            </div>
          ) : null
        }
      />
      <ConfirmDialog
        open={dialog?.type === 'convert'}
        onClose={close}
        onConfirm={confirmConvert}
        title="Convert to client?"
        confirmLabel="Convert"
        tone="default"
        loading={convert.isPending}
        error={refusal}
      >
        <p>
          A new active client,{' '}
          <strong className="font-medium text-text">{target?.name}</strong>, is created from this
          lead with its type, email, phone and notes
          {target?.contact_name ? `, and ${target.contact_name} as its primary contact` : ''}. The
          client code comes from your client numbering.
        </p>
        <p>The lead moves to Converted and keeps its costs, which you can still change.</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog?.type === 'archive'}
        onClose={close}
        onConfirm={() => {
          if (dialog?.type === 'archive') setArchived(dialog.lead, true, close);
        }}
        title="Archive lead?"
        confirmLabel="Archive"
        tone="default"
        loading={archive.isPending}
        error={refusal}
      >
        <p>
          <strong className="font-medium text-text">{target?.name}</strong> moves to Archived and
          can no longer be converted. Unarchive it at any time to pick it up again.
        </p>
      </ConfirmDialog>
    </>
  );
}

/**
 * `/:orgSlug/clients/leads`: prospective clients and what winning them costs (`client.read`).
 * `client.create` adds and converts leads, `client.update` edits them and `client.delete`
 * archives and unarchives them.
 */
export default function LeadsPage() {
  const { organization } = useOrg();
  useDocumentTitle('Leads');
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="Leads"
        description="Prospective clients and what winning them costs: acquisition and onboarding. Convert a lead into a client in one click once it is won, or archive it."
        actions={
          <Link
            to={routes.org.clients(organization.slug)}
            className={buttonClasses({ variant: 'secondary', size: 'sm' })}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Client List
          </Link>
        }
        className="mb-1"
      />
      <LeadList />
    </section>
  );
}
