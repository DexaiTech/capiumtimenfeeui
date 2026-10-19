import { Archive, ArchiveRestore } from 'lucide-react';

import { Button } from '@/components/ui';

import type { ClientDetail } from '../../types';
import type { ClientAbilities } from '../abilities';
import { useClientLifecycle } from '../useClientLifecycle';
import { SettingsCard } from './SettingsCard';

export interface DangerCardProps {
  client: ClientDetail;
  abilities: ClientAbilities;
}

/** Archive or restore the client, each behind a confirmation. Needs `client.delete`. */
export function DangerCard({ client, abilities }: DangerCardProps) {
  const lifecycle = useClientLifecycle(client);
  if (!abilities.archive && !abilities.restore) return null;

  return (
    <SettingsCard
      title="Danger zone"
      description={
        abilities.restore
          ? 'This client is archived.'
          : 'Archiving takes the client out of everyday use. It can be restored.'
      }
      danger
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-muted sm:max-w-xl">
          {abilities.restore
            ? 'Restore the client to show it in the client list and the pickers again, and to record new work for it.'
            : 'An archived client is hidden from the client list and the pickers and accepts no new jobs, time or disbursements. Existing WIP can still be billed.'}
        </p>
        {abilities.restore ? (
          <Button
            leftIcon={<ArchiveRestore aria-hidden="true" className="size-4" />}
            onClick={lifecycle.askRestore}
          >
            Restore client
          </Button>
        ) : (
          <Button
            variant="danger"
            leftIcon={<Archive aria-hidden="true" className="size-4" />}
            onClick={lifecycle.askArchive}
          >
            Archive client
          </Button>
        )}
      </div>
      {lifecycle.dialog}
    </SettingsCard>
  );
}
