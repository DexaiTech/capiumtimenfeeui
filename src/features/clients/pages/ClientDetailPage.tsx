import { ArrowLeft, FileX2 } from 'lucide-react';
import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router';

import { buttonClasses, Card, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';
import { isApiError } from '@/services/api';

import { useClient, useClientOverview, useStaffDirectory } from '../api';
import { useRecentClientsStore } from '../recents';
import { clientAbilities, type ClientAbilities } from '../workspace/abilities';
import { ClientHeader } from '../workspace/ClientHeader';
import { ClientTabs } from '../workspace/ClientTabs';
import { isClientTabId, visibleTabs } from '../workspace/constants';
import { OverviewTab } from '../workspace/overview/OverviewTab';
import { SettingsTab } from '../workspace/settings/SettingsTab';
import { ContactsTab } from '../workspace/tabs/ContactsTab';
import { ExpensesTab } from '../workspace/tabs/ExpensesTab';
import { HistoryTab } from '../workspace/tabs/HistoryTab';
import { InvoicesTab } from '../workspace/tabs/InvoicesTab';
import { JobsTab } from '../workspace/tabs/JobsTab';
import { PaymentsTab } from '../workspace/tabs/PaymentsTab';
import { TimeTab } from '../workspace/tabs/TimeTab';
import { WipTab } from '../workspace/tabs/WipTab';
import type { ClientOverview, ClientTabId } from '../workspace/types';
import type { ClientDetail, MemberRead } from '../types';

function BackLink() {
  const { organization } = useOrg();
  return (
    <Link
      to={routes.org.clients(organization.slug)}
      className="inline-flex items-center gap-1.5 self-start rounded-sm text-sm font-medium text-brand-text underline underline-offset-2 hover:text-brand-hover"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Back to Clients
    </Link>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-4" role="status" aria-label="Loading the client">
      <BackLink />
      <h1 className="sr-only">Client</h1>
      <Card padding="md" className="flex items-center gap-4">
        <Skeleton shape="circle" className="size-14" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton shape="rect" className="h-5 w-1/3" />
          <Skeleton shape="rect" className="h-4 w-1/2" />
        </div>
      </Card>
      <Skeleton shape="rect" className="h-9 w-full max-w-xl" />
      <Skeleton shape="rect" className="h-48 w-full" />
    </div>
  );
}

interface TabPanelProps {
  tab: ClientTabId;
  client: ClientDetail;
  abilities: ClientAbilities;
  overview: ReturnType<typeof useClientOverview>;
  members: MemberRead[] | undefined;
}

/** The content of the open tab. Each tab is its own component, so only the open one fetches. */
function TabPanel({ tab, client, abilities, overview, members }: TabPanelProps) {
  const summary: ClientOverview | undefined = overview.data;
  switch (tab) {
    case 'overview':
      return <OverviewTab client={client} overview={overview} members={members} />;
    case 'jobs':
      return <JobsTab clientId={client.id} clientName={client.name} overview={summary} />;
    case 'time':
      return <TimeTab clientId={client.id} clientName={client.name} overview={summary} />;
    case 'expenses':
      return <ExpensesTab clientId={client.id} clientName={client.name} overview={summary} />;
    case 'wip':
      return <WipTab clientId={client.id} clientName={client.name} />;
    case 'invoices':
      return (
        <InvoicesTab
          clientId={client.id}
          clientCode={client.code}
          clientName={client.name}
          overview={summary}
        />
      );
    case 'payments':
      return <PaymentsTab clientId={client.id} clientName={client.name} overview={summary} />;
    case 'contacts':
      return <ContactsTab client={client} canEdit={abilities.edit} />;
    case 'history':
      return <HistoryTab clientId={client.id} />;
    case 'settings':
      return <SettingsTab client={client} abilities={abilities} />;
  }
}

function ClientWorkspace({ clientId, tab }: { clientId: string; tab: ClientTabId }) {
  const { organization, can } = useOrg();
  const detail = useClient(clientId);
  const overview = useClientOverview(clientId);
  const staff = useStaffDirectory();
  const remember = useRecentClientsStore((state) => state.remember);
  const forget = useRecentClientsStore((state) => state.forget);
  const client = detail.data;
  const knownId = client?.id;
  const knownName = client?.name;
  const knownCode = client?.code;
  const notFound = detail.isError && isApiError(detail.error) && detail.error.status === 404;
  useDocumentTitle(client?.name ?? 'Client');

  // The Client 360 page lists the clients opened last; one that no longer exists drops out.
  useEffect(() => {
    if (knownId && knownName !== undefined && knownCode !== undefined) {
      remember(organization.id, { id: knownId, name: knownName, code: knownCode });
    }
  }, [remember, organization.id, knownId, knownName, knownCode]);
  useEffect(() => {
    if (notFound) forget(organization.id, clientId);
  }, [forget, organization.id, clientId, notFound]);

  if (detail.isPending) return <WorkspaceSkeleton />;

  if (detail.isError) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <BackLink />
        <h1 className="sr-only">Client</h1>
        <Card padding="none">
          {notFound ? (
            <EmptyState
              icon={<FileX2 className="size-6" />}
              title="Client not found"
              description="This client does not exist or has been deleted."
              action={
                <Link
                  to={routes.org.clients(organization.slug)}
                  className={buttonClasses({ variant: 'primary' })}
                >
                  Back to Clients
                </Link>
              }
            />
          ) : (
            <ErrorState
              title="Could not load the client"
              error={isApiError(detail.error) ? detail.error : null}
              onRetry={() => void detail.refetch()}
              retrying={detail.isRefetching}
              className="py-10"
            />
          )}
        </Card>
      </div>
    );
  }

  const abilities = clientAbilities(detail.data, can);
  const tabs = visibleTabs(can);
  const current = tabs.find((entry) => entry.id === tab);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <BackLink />
      <ClientHeader client={detail.data} />
      <ClientTabs
        clientId={detail.data.id}
        tabs={tabs}
        active={tab}
        counts={overview.data?.tab_counts}
      />
      <section
        role="tabpanel"
        aria-label={current?.label ?? 'Client'}
        className="flex min-w-0 flex-col gap-4"
      >
        <TabPanel
          tab={tab}
          client={detail.data}
          abilities={abilities}
          overview={overview}
          members={staff.data}
        />
      </section>
    </div>
  );
}

/**
 * `/:orgSlug/clients/:clientId/<tab>`: the Client 360 workspace of one client. The tab is the
 * last URL segment (`overview`, `jobs`, `time`, `expenses`, `wip`, `invoices`, `payments`,
 * `contacts`, `history`, `settings`), so every tab can be bookmarked and shared. A missing, unknown or
 * not permitted tab opens the overview.
 */
export default function ClientDetailPage() {
  const { clientId, '*': splat } = useParams();
  const { organization, can } = useOrg();
  if (!clientId) return null;

  const requested = splat ?? '';
  const allowed = visibleTabs(can).some((tab) => tab.id === requested);
  if (!isClientTabId(requested) || !allowed) {
    return <Navigate to={routes.org.client(organization.slug, clientId, 'overview')} replace />;
  }
  return <ClientWorkspace clientId={clientId} tab={requested} />;
}
