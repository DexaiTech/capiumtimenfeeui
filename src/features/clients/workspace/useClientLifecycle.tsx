import { useState, type ReactNode } from 'react';

import { ConfirmDialog, useToast } from '@/components/ui';

import { useArchiveClient, useUpdateClient } from '../api';
import type { ClientDetail } from '../types';
import { describeError, type Failure } from './errors';

export interface ClientLifecycle {
  askArchive: () => void;
  askRestore: () => void;
  /** The confirmation dialog: render it once next to the buttons that open it. */
  dialog: ReactNode;
}

/**
 * Archiving and restoring a client, each behind a confirmation. Archiving hides it from the list
 * and the pickers; restoring (status `active`) brings it back.
 */
export function useClientLifecycle(client: Pick<ClientDetail, 'id' | 'name'>): ClientLifecycle {
  const { toast } = useToast();
  const archive = useArchiveClient();
  const update = useUpdateClient();
  const [asking, setAsking] = useState<'archive' | 'restore' | null>(null);
  const [refusal, setRefusal] = useState<Failure | null>(null);

  const ask = (what: 'archive' | 'restore') => () => {
    setRefusal(null);
    setAsking(what);
  };
  const close = () => {
    setAsking(null);
    setRefusal(null);
  };

  const confirm = async () => {
    try {
      if (asking === 'restore') {
        await update.mutateAsync({ clientId: client.id, body: { status: 'active' } });
        toast({ tone: 'success', title: 'Client restored', description: client.name });
      } else {
        await archive.mutateAsync(client.id);
        toast({ tone: 'success', title: 'Client archived', description: client.name });
      }
      close();
    } catch (error) {
      setRefusal(describeError(error));
    }
  };

  const restoring = asking === 'restore';
  const dialog = (
    <ConfirmDialog
      open={asking !== null}
      onClose={close}
      onConfirm={() => void confirm()}
      title={restoring ? 'Restore client' : 'Archive client'}
      confirmLabel={restoring ? 'Restore' : 'Archive'}
      tone="default"
      loading={archive.isPending || update.isPending}
      error={refusal}
    >
      {restoring ? (
        <p>
          {client.name} becomes active again: it returns to the client list and the pickers and
          accepts new work.
        </p>
      ) : (
        <p>
          {client.name} will be hidden from the client list and pickers. No new jobs, time or
          disbursements can be recorded; existing WIP can still be billed.
        </p>
      )}
    </ConfirmDialog>
  );

  return { askArchive: ask('archive'), askRestore: ask('restore'), dialog };
}
