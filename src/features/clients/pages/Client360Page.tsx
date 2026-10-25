import { Building2, History } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { PageHeader } from '@/components/layout';
import { Button, Card, CardHeader, EmptyState, InitialsAvatar } from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';

import { CentralClientsDialog } from '../central/CentralClientsDialog';
import { ClientPicker } from '../picker/ClientPicker';
import { useRecentClients, useRecentClientsStore } from '../recents';
import { CLIENT_STATUSES } from '../types';

/**
 * `/:orgSlug/clients/360`: the way into a client's workspace. Search the practice's clients by
 * name or code and open one, or go back to one of the clients opened last (kept in this browser,
 * per practice). Clients that are in the Capium central client service but not yet here can be
 * found and enabled from the shortcut.
 */
export default function Client360Page() {
  const { organization, can } = useOrg();
  const navigate = useNavigate();
  const recents = useRecentClients(organization.id);
  const clearRecents = useRecentClientsStore((state) => state.clear);
  const [centralOpen, setCentralOpen] = useState(false);
  useDocumentTitle('Client Overview');

  const overview = (clientId: string) => routes.org.client(organization.slug, clientId, 'overview');

  return (
    <>
      <PageHeader
        title="Client Overview"
        description="Pick a client to see everything about them in one place."
      />
      <div className="grid w-full items-start gap-4 lg:grid-cols-2">
        <Card padding="md" role="search" aria-label="Find a client" className="flex flex-col gap-4">
          <ClientPicker
            label="Find a client"
            value={null}
            // Archived clients are found too: their history is still worth opening.
            statuses={CLIENT_STATUSES}
            clearable={false}
            placeholder="Search by client name or code"
            onChange={(client) => {
              if (client) void navigate(overview(client.id));
            }}
          />
          {can(PERMISSIONS.clientCreate) ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-4 text-sm text-text-muted">
              <span>Not in your client list yet?</span>
              <Button
                size="sm"
                leftIcon={<Building2 aria-hidden="true" className="size-4" />}
                onClick={() => setCentralOpen(true)}
              >
                Find a client in Capium central
              </Button>
            </div>
          ) : null}
        </Card>

        <Card padding="none" role="region" aria-label="Recently viewed">
          <CardHeader
            title="Recently viewed"
            description="The clients you opened last, newest first."
            actions={
              recents.length > 0 ? (
                <Button size="sm" variant="ghost" onClick={() => clearRecents(organization.id)}>
                  Clear
                </Button>
              ) : undefined
            }
          />
          {recents.length === 0 ? (
            <EmptyState
              icon={<History className="size-6" />}
              title="No recently viewed clients"
              description="Clients you open appear here, so you can get back to them in one click."
              size="compact"
            />
          ) : (
            <ul className="divide-y divide-row-border">
              {recents.map((client) => (
                <li key={client.id}>
                  <Link
                    to={overview(client.id)}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover"
                  >
                    <InitialsAvatar name={client.name} size="sm" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold text-text">
                        {client.name}
                      </span>
                      <span className="truncate text-xs text-text-muted">{client.code}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <CentralClientsDialog open={centralOpen} onClose={() => setCentralOpen(false)} />
    </>
  );
}
