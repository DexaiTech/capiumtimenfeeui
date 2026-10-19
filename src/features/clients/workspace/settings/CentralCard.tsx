import { Link2, Link2Off, RefreshCw } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button, ConfirmDialog, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { formatUkDateTime } from '@/utils/dates';

import { useUnlinkCentralClient } from '../../api';
import { CentralChip } from '../../central/CentralChip';
import { centralChip, isLinked } from '../../central/format';
import { LinkCentralDialog } from '../../central/LinkCentralDialog';
import type { ClientDetail } from '../../types';
import type { ClientAbilities } from '../abilities';
import { describeError, type Failure } from '../errors';
import { useSyncAction } from '../useSyncAction';
import { SettingsCard } from './SettingsCard';

export interface CentralCardProps {
  client: ClientDetail;
  abilities: ClientAbilities;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="text-sm text-text-muted sm:w-44 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 text-sm text-text">{children}</dd>
    </div>
  );
}

/** The link between this client and the Capium central client service. */
export function CentralCard({ client, abilities }: CentralCardProps) {
  const { organization } = useOrg();
  const { toast } = useToast();
  const { sync, syncing } = useSyncAction(client);
  const unlink = useUnlinkCentralClient();
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [refusal, setRefusal] = useState<Failure | null>(null);
  const linked = isLinked(client);
  const info = centralChip(client, organization.timezone);

  const closeUnlink = () => {
    setUnlinking(false);
    setRefusal(null);
  };
  const confirmUnlink = async () => {
    try {
      await unlink.mutateAsync(client.id);
      toast({ tone: 'success', title: 'Client unlinked', description: client.name });
      closeUnlink();
    } catch (error) {
      setRefusal(describeError(error));
    }
  };

  return (
    <SettingsCard
      title="Central client"
      description="Clients enabled from the Capium central client service take their name and address from there."
      actions={
        <span className="flex flex-wrap items-center gap-2">
          {abilities.sync ? (
            <Button
              size="sm"
              leftIcon={<RefreshCw aria-hidden="true" className="size-4" />}
              loading={syncing}
              onClick={() => void sync()}
            >
              Sync with central
            </Button>
          ) : null}
          {abilities.unlink ? (
            <Button
              size="sm"
              leftIcon={<Link2Off aria-hidden="true" className="size-4" />}
              onClick={() => setUnlinking(true)}
            >
              Unlink
            </Button>
          ) : null}
          {abilities.link ? (
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Link2 aria-hidden="true" className="size-4" />}
              onClick={() => setLinking(true)}
            >
              Link to a central client
            </Button>
          ) : null}
        </span>
      }
    >
      <dl className="flex flex-col gap-3">
        <Row label="Status">
          <span className="flex flex-wrap items-center gap-2">
            <CentralChip client={client} />
            <span className="text-text-muted">{info.title}</span>
          </span>
        </Row>
        {linked ? (
          <>
            <Row label="Central client ID">
              <code className="font-mono text-xs break-all">{client.central_client_id}</code>
            </Row>
            <Row label="Last confirmed">
              {client.central_synced_at
                ? formatUkDateTime(client.central_synced_at, organization.timezone)
                : 'Never'}
            </Row>
          </>
        ) : null}
      </dl>
      {abilities.readOnly ? (
        <p className="mt-3 text-sm text-text-muted">
          This client was merged into another one: its link to the central service is kept as
          history and cannot be changed.
        </p>
      ) : null}
      <LinkCentralDialog
        client={linking ? { id: client.id, name: client.name, code: client.code } : null}
        onClose={() => setLinking(false)}
      />
      <ConfirmDialog
        open={unlinking}
        onClose={closeUnlink}
        onConfirm={() => void confirmUnlink()}
        title="Unlink from central"
        confirmLabel="Unlink"
        loading={unlink.isPending}
        error={refusal}
      >
        <p>
          Unlink {client.name} from the central client service? Its name and address become editable
          here and are no longer updated from central. Nothing else changes.
        </p>
      </ConfirmDialog>
    </SettingsCard>
  );
}
