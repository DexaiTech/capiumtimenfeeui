import {
  Archive,
  ArchiveRestore,
  Ellipsis,
  Link2Off,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import {
  Button,
  buttonClasses,
  Dropdown,
  HealthBar,
  InitialsAvatar,
  useToast,
  type DropdownItem,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { modulePath, ORG_SEGMENTS, routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';

import { useStaffDirectory } from '../api';
import { CentralChip } from '../central/CentralChip';
import { ClientFormPanel } from '../components/ClientFormPanel';
import type { ClientDetail } from '../types';
import { clientAbilities } from './abilities';
import { ClientStatusBadge, ClientTypeBadge, SegmentBadge } from './badges';
import { useClientLifecycle } from './useClientLifecycle';
import { useSyncAction } from './useSyncAction';

export interface ClientHeaderProps {
  client: ClientDetail;
}

/**
 * The card on top of a client's workspace: who it is (name, code, type, status, central chip),
 * who looks after it, its health and the actions: Edit, Sync with central, Archive or Restore and
 * a menu. A client merged into another is read-only history and says where its work went.
 */
export function ClientHeader({ client }: ClientHeaderProps) {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const navigate = useNavigate();
  const abilities = clientAbilities(client, can);
  // A new job for this client opens with the client already chosen.
  const canBill = can(PERMISSIONS.invoiceCreate) && !abilities.readOnly;
  const canStartJob =
    can(PERMISSIONS.jobCreate) && !abilities.readOnly && client.status !== 'archived';
  const staff = useStaffDirectory();
  const lifecycle = useClientLifecycle(client);
  const { sync, syncing } = useSyncAction(client);
  const [editing, setEditing] = useState(false);

  const person = (userId: string | null) =>
    userId ? (staff.data?.find((member) => member.user_id === userId)?.full_name ?? null) : null;
  const partner = person(client.partner_user_id);
  const manager = person(client.manager_user_id);

  const copyLink = () => {
    const url = new URL(
      routes.org.client(organization.slug, client.id, 'overview'),
      window.location.origin,
    );
    navigator.clipboard.writeText(url.href).then(
      () => toast({ tone: 'success', title: 'Link copied', description: client.name }),
      () => toast({ tone: 'error', title: 'Could not copy the link' }),
    );
  };

  const menu: DropdownItem[] = [
    { id: 'copy', label: 'Copy link to this client', onSelect: copyLink },
    {
      id: 'settings',
      label: 'Client settings',
      onSelect: () => void navigate(routes.org.client(organization.slug, client.id, 'settings')),
    },
  ];

  return (
    <header className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-card sm:p-5">
      <ClientFormPanel open={editing} client={client} onClose={() => setEditing(false)} />
      <div className="flex flex-wrap items-start gap-4">
        <InitialsAvatar
          name={client.name}
          initials={client.initials}
          colorKey={client.id}
          size="lg"
        />
        <div className="flex min-w-0 flex-1 basis-72 flex-col gap-2">
          <h1 className="text-lg font-semibold break-words text-text uppercase" title={client.name}>
            {client.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="font-medium text-text-muted">{client.code}</span>
            <ClientTypeBadge type={client.client_type} />
            <ClientStatusBadge status={client.status} />
            <CentralChip client={client} />
            {client.segment ? <SegmentBadge segment={client.segment} /> : null}
          </div>
          <dl className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
            {partner ? (
              <div className="flex gap-1.5">
                <dt className="text-text-muted">Partner</dt>
                <dd className="font-medium text-text">{partner}</dd>
              </div>
            ) : null}
            {manager ? (
              <div className="flex gap-1.5">
                <dt className="text-text-muted">Manager</dt>
                <dd className="font-medium text-text">{manager}</dd>
              </div>
            ) : null}
            {client.health_score !== null ? (
              <div className="flex items-center gap-1.5">
                <dt className="text-text-muted">Health</dt>
                <dd>
                  <HealthBar score={client.health_score} label="Client health" />
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canStartJob ? (
            <Link
              to={`${routes.org.jobs(organization.slug)}?new=1&client_id=${client.id}`}
              className={buttonClasses({ variant: 'primary' })}
            >
              <Plus aria-hidden="true" className="size-4" />
              New job
            </Link>
          ) : null}
          {canBill ? (
            <Link
              to={`${modulePath(organization.slug, ORG_SEGMENTS.billing, 'prepare')}?client=${client.id}`}
              className={buttonClasses({ variant: 'secondary' })}
            >
              <ReceiptText aria-hidden="true" className="size-4" />
              Bill client
            </Link>
          ) : null}
          {abilities.edit ? (
            <Button
              leftIcon={<Pencil aria-hidden="true" className="size-4" />}
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          ) : null}
          {abilities.sync ? (
            <Button
              leftIcon={<RefreshCw aria-hidden="true" className="size-4" />}
              loading={syncing}
              onClick={() => void sync()}
            >
              Sync with central
            </Button>
          ) : null}
          {abilities.archive ? (
            <Button
              leftIcon={<Archive aria-hidden="true" className="size-4" />}
              onClick={lifecycle.askArchive}
            >
              Archive
            </Button>
          ) : null}
          {abilities.restore ? (
            <Button
              leftIcon={<ArchiveRestore aria-hidden="true" className="size-4" />}
              onClick={lifecycle.askRestore}
            >
              Restore
            </Button>
          ) : null}
          <Dropdown
            label="More actions"
            items={menu}
            trigger={<Ellipsis aria-hidden="true" className="size-5 text-text-muted" />}
          />
        </div>
      </div>

      {client.merged_into ? (
        <p
          role="status"
          className="flex flex-wrap items-center gap-x-1.5 rounded-md border border-border bg-surface-sunken px-3 py-2 text-xs text-text"
        >
          <Link2Off aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
          <span>
            This client was merged into{' '}
            <Link
              to={routes.org.client(organization.slug, client.merged_into.id, 'overview')}
              className="font-semibold text-brand-text hover:underline"
            >
              {client.merged_into.name} ({client.merged_into.code})
            </Link>
            . It is kept as history: its work now sits with that client.
          </span>
        </p>
      ) : null}

      {lifecycle.dialog}
    </header>
  );
}
