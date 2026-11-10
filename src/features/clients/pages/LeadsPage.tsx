import { Download, SearchX, Target, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { PageHeader } from '@/components/layout';
import {
  Badge,
  Button,
  Card,
  ColumnVisibilityMenu,
  ConfirmDialog,
  CountTabs,
  DataTable,
  EmptyState,
  ErrorState,
  PageToolbar,
  Pagination,
  RowActions,
  SearchField,
  Select,
  useToast,
  type ConfirmDialogError,
  type DataTableColumn,
  type DropdownItem,
} from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { useBranches, useBranchesEnabled } from '@/features/settings';
import { useDebouncedValue, useDocumentTitle, usePersistentColumns, useUrlParams } from '@/hooks';
import { isApiError } from '@/services/api';
import { downloadText, toCsv } from '@/utils/csv';
import { formatDayMonthYear, formatUkDate, todayInZone } from '@/utils/dates';
import { formatMoney, penceToPoundsInput } from '@/utils/money';

import '@/styles/capium-clients.css';

import {
  flattenPages,
  useArchiveLead,
  useClientSummary,
  useConvertLead,
  useLeadList,
  useLeadSummary,
} from '../api';
import { ClientsLeadsSwitch } from '../components/ClientsLeadsSwitch';
import { branchOptions, CLIENT_TYPE_LABELS } from '../constants';
import { LeadFormPanel } from '../leads/LeadFormPanel';
import { LEAD_STATUSES, type Lead, type LeadStatus } from '../leads/types';

const TABS: ReadonlyArray<{ value: LeadStatus; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'converted', label: 'Converted' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_BADGE: Record<LeadStatus, { label: string; tone: 'info' | 'success' | 'neutral' }> = {
  open: { label: 'Open', tone: 'info' },
  converted: { label: 'Converted', tone: 'success' },
  archived: { label: 'Archived', tone: 'neutral' },
};

type DialogState =
  | { type: 'form'; lead: Lead | null }
  | { type: 'convert'; lead: Lead }
  | { type: 'archive'; lead: Lead }
  | null;

/** A column of the list with the CSV columns "Export selected" writes for it, as shown. */
type LeadColumn = DataTableColumn<Lead> & {
  csv: ReadonlyArray<readonly [header: string, value: (lead: Lead) => string | null]>;
};

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

  const [hidden, setHidden] = usePersistentColumns('leads');
  // The ticks belong to one tab and search: another list starts with nothing selected, and a
  // ticked lead that leaves the list (archived, converted) is no longer exported. While a new
  // list loads, the rows of the previous one still on screen cannot be exported.
  const listKey = `${tab}|${searched}`;
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [selectedFor, setSelectedFor] = useState(listKey);
  if (selectedFor !== listKey) {
    setSelectedFor(listKey);
    setSelected(new Set());
  }
  const chosen = leads.isPlaceholderData ? [] : loaded.filter((lead) => selected.has(lead.id));

  const [dialog, setDialog] = useState<DialogState>(null);
  const [refusal, setRefusal] = useState<ConfirmDialogError | null>(null);
  // While the practice uses branches (APT74), the new client needs one.
  const branchesOn = useBranchesEnabled();
  const branches = useBranches(branchesOn);
  const [convertBranch, setConvertBranch] = useState('');
  const close = () => {
    setDialog(null);
    setRefusal(null);
    setConvertBranch('');
  };

  const clientHref = (clientId: string) => routes.org.client(organization.slug, clientId);

  const confirmConvert = () => {
    if (dialog?.type !== 'convert') return;
    const { lead } = dialog;
    convert.mutate(
      { leadId: lead.id, body: branchesOn ? { branch_id: convertBranch } : undefined },
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

  const columns: LeadColumn[] = [
    {
      id: 'name',
      header: 'Lead',
      hideable: false,
      plain: true,
      csv: [
        ['Lead', (lead) => lead.name],
        ['Contact', (lead) => lead.contact_name],
        ['Email', (lead) => lead.email],
        ['Phone', (lead) => lead.phone],
      ],
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
      csv: [['Source', (lead) => lead.source]],
    },
    {
      id: 'acquisition',
      header: 'Acquisition',
      align: 'end',
      plain: true,
      className: 'w-32 whitespace-nowrap tabular-nums',
      cell: (lead) => formatMoney(lead.acquisition_cost, currency),
      csv: [['Acquisition', (lead) => penceToPoundsInput(lead.acquisition_cost, currency)]],
    },
    {
      id: 'onboarding',
      header: 'Onboarding',
      align: 'end',
      plain: true,
      className: 'w-32 whitespace-nowrap tabular-nums',
      cell: (lead) => formatMoney(lead.onboarding_cost, currency),
      csv: [['Onboarding', (lead) => penceToPoundsInput(lead.onboarding_cost, currency)]],
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
      csv: [['Total cost', (lead) => penceToPoundsInput(lead.total_cost, currency)]],
    },
    {
      id: 'status',
      header: 'Status',
      hideable: false,
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
      csv: [['Status', (lead) => STATUS_BADGE[lead.status].label]],
    },
    {
      id: 'added',
      header: 'Added',
      plain: true,
      className: 'w-28 whitespace-nowrap',
      cell: (lead) => formatDayMonthYear(lead.created_at, organization.timezone),
      csv: [
        [
          'Added',
          (lead) => formatUkDate(todayInZone(organization.timezone, new Date(lead.created_at))),
        ],
      ],
    },
  ];

  /**
   * The selected leads as a CSV of the columns on screen, in their order. Like the other exports,
   * amounts are pounds with two decimals and dates are dd/mm/yyyy, so a spreadsheet reads them.
   */
  const exportSelected = () => {
    const cells = columns
      .filter((column) => !hidden.has(column.id))
      .flatMap((column) => column.csv);
    downloadText(
      'leads-selected.csv',
      toCsv([
        cells.map(([header]) => header),
        ...chosen.map((lead) => cells.map(([, value]) => value(lead))),
      ]),
    );
  };

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
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        selectLabel={(lead) => `Select ${lead.name}`}
        hiddenColumns={hidden}
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
            actions={
              <>
                <ColumnVisibilityMenu
                  columns={columns.map((column) => ({
                    id: column.id,
                    label: column.header,
                    locked: column.hideable === false,
                  }))}
                  hidden={hidden}
                  onChange={setHidden}
                />
                <Button
                  size="sm"
                  variant="brand-outline"
                  disabled={chosen.length === 0}
                  leftIcon={<Download aria-hidden="true" className="size-4" />}
                  onClick={exportSelected}
                >
                  Export selected
                </Button>
              </>
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
                  <Button variant="primary" onClick={() => setDialog({ type: 'form', lead: null })}>
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
        confirmDisabled={branchesOn && convertBranch === ''}
        error={refusal}
      >
        <p>
          A new active client, <strong className="font-medium text-text">{target?.name}</strong>, is
          created from this lead with its type, email, phone and notes
          {target?.contact_name ? `, and ${target.contact_name} as its primary contact` : ''}. The
          client code comes from your client numbering.
        </p>
        <p>The lead moves to Converted and keeps its costs, which you can still change.</p>
        {branchesOn ? (
          <Select
            label="Branch"
            required
            options={[
              { value: '', label: 'Choose a branch' },
              ...branchOptions(branches.data ?? [], null),
            ]}
            value={convertBranch}
            onChange={(event) => setConvertBranch(event.target.value)}
          />
        ) : null}
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
        {target?.converted_client_id ? (
          // Archiving a converted lead never touches the client it became.
          <p>
            <strong className="font-medium text-text">{target.name}</strong> moves to Archived. The
            client it became is not changed. Unarchive it at any time.
          </p>
        ) : (
          <p>
            <strong className="font-medium text-text">{target?.name}</strong> moves to Archived and
            can no longer be converted. Unarchive it at any time to pick it up again.
          </p>
        )}
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
  useDocumentTitle('Leads');
  const clients = useClientSummary();
  const leads = useLeadSummary();
  return (
    <section className="flex min-w-0 flex-col gap-4">
      {/* The same Clients | Leads tabs as the Client List, so neither page hides the other. */}
      <div className="capium-clients">
        <ClientsLeadsSwitch
          current="leads"
          clientCount={clients.data?.total ?? null}
          leadCount={leads.data?.open.count ?? null}
        />
      </div>
      <PageHeader
        title="Leads"
        description="Prospective clients and what winning them costs: acquisition and onboarding. Convert a lead into a client in one click once it is won, or archive it."
        className="mb-1"
      />
      <LeadList />
    </section>
  );
}
