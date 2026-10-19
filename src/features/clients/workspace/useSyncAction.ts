import { useToast } from '@/components/ui';

import { useSyncClient } from '../api';
import { describeSync } from '../central/format';
import type { ClientDetail } from '../types';
import { describeError } from './errors';

/** "Sync with central" for one client: pulls the central name and address and says what happened. */
export function useSyncAction(client: Pick<ClientDetail, 'id'>) {
  const { toast } = useToast();
  const sync = useSyncClient();
  const run = async () => {
    try {
      toast(describeSync(await sync.mutateAsync(client.id)));
    } catch (error) {
      toast({
        tone: 'error',
        title: 'Could not synchronise the client',
        description: describeError(error).message,
      });
    }
  };
  return { sync: run, syncing: sync.isPending };
}
