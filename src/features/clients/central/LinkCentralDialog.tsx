import { CircleAlert } from 'lucide-react';
import { useState } from 'react';

import { Badge, Button, Modal, useToast } from '@/components/ui';
import { isApiError } from '@/services/api';

import { useLinkCentralClient } from '../api';
import type { ClientRead } from '../types';
import { CentralSearch } from './CentralSearch';
import type { CentralClient } from './types';

export interface LinkCentralDialogProps {
  /** The client to link; null keeps the dialog closed. */
  client: Pick<ClientRead, 'id' | 'name' | 'code'> | null;
  onClose: () => void;
}

function LinkContent({
  client,
  onClose,
}: {
  client: Pick<ClientRead, 'id' | 'name' | 'code'>;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const link = useLinkCentralClient();
  const [linking, setLinking] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const onLink = async (central: CentralClient) => {
    setRefusal(null);
    setLinking(central.central_id);
    try {
      await link.mutateAsync({ clientId: client.id, centralId: central.central_id });
      toast({
        tone: 'success',
        title: 'Client linked',
        description: `${client.name} now follows the central name and address.`,
      });
      onClose();
    } catch (error) {
      setRefusal(isApiError(error) ? error.message : 'Could not link the client. Try again.');
    } finally {
      setLinking(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {refusal ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-text"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger" />
          {refusal}
        </p>
      ) : null}
      <CentralSearch
        renderNote={(central) =>
          central.enabled ? (
            <p className="text-xs text-text-muted">
              Already linked to {central.client_code ?? 'another client'} of this practice.
            </p>
          ) : null
        }
        renderAction={(central) =>
          central.enabled ? (
            <Badge tone="grey" size="sm">
              In use
            </Badge>
          ) : (
            <Button
              size="sm"
              variant="brand-outline"
              aria-label={`Link to ${central.name}`}
              title={
                central.status === 'archived'
                  ? 'Archived centrally: it cannot be linked'
                  : undefined
              }
              loading={linking === central.central_id}
              disabled={
                central.status === 'archived' || (link.isPending && linking !== central.central_id)
              }
              onClick={() => void onLink(central)}
            >
              Link
            </Button>
          )
        }
      />
    </div>
  );
}

/**
 * Links an existing client to a central client (`client.create`): the client then takes the
 * central name and address, which are managed there from now on.
 */
export function LinkCentralDialog({ client, onClose }: LinkCentralDialogProps) {
  return (
    <Modal
      open={client !== null}
      onClose={onClose}
      title="Link to a central client"
      description={
        client
          ? `${client.name} takes the name and address of the central client you choose; they are then managed centrally.`
          : undefined
      }
      size="lg"
    >
      {client ? <LinkContent key={client.id} client={client} onClose={onClose} /> : null}
    </Modal>
  );
}
