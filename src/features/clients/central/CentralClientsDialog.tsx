import { Check } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { Badge, Button, Modal, useToast } from '@/components/ui';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { isApiError } from '@/services/api';

import { useEnableCentralClient } from '../api';
import { CentralSearch } from './CentralSearch';
import { describeEnabled } from './format';
import type { CentralClient } from './types';

export interface CentralClientsDialogProps {
  open: boolean;
  onClose: () => void;
}

function CentralClientsContent({ onClose }: { onClose: () => void }) {
  const { organization } = useOrg();
  const navigate = useNavigate();
  const { toast } = useToast();
  const enable = useEnableCentralClient();
  const [enabling, setEnabling] = useState<string | null>(null);

  const openClient = (clientId: string) => {
    onClose();
    void navigate(routes.org.client(organization.slug, clientId, 'overview'));
  };

  const onEnable = async (client: CentralClient) => {
    setEnabling(client.central_id);
    try {
      const enabled = await enable.mutateAsync(client.central_id);
      toast({
        ...describeEnabled(enabled),
        action: { label: 'Open client', onClick: () => openClient(enabled.client.id) },
        duration: 10_000,
      });
    } catch (error) {
      toast({
        tone: 'error',
        title: 'Could not enable the client',
        description: isApiError(error) ? error.message : undefined,
      });
    } finally {
      setEnabling(null);
    }
  };

  return (
    <CentralSearch
      renderNote={(client) =>
        client.matching_client && !client.enabled ? (
          <p className="text-xs text-text-muted">
            Matches your client{' '}
            <span className="font-medium text-text">
              {client.matching_client.name} ({client.matching_client.code})
            </span>
            : enabling links it instead of creating a new client.
          </p>
        ) : null
      }
      renderAction={(client) =>
        client.enabled && client.client_id ? (
          <>
            <Badge tone="green" size="sm" icon={<Check aria-hidden="true" className="size-3" />}>
              Enabled
            </Badge>
            <Button
              size="sm"
              aria-label={`Open ${client.client_code ?? client.name}`}
              onClick={() => openClient(client.client_id ?? '')}
            >
              Open client
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="brand-outline"
            aria-label={`Enable ${client.name}`}
            title={
              client.status === 'archived' ? 'Archived centrally: it cannot be enabled' : undefined
            }
            loading={enabling === client.central_id}
            disabled={
              client.status === 'archived' || (enable.isPending && enabling !== client.central_id)
            }
            onClick={() => void onEnable(client)}
          >
            Enable
          </Button>
        )
      }
    />
  );
}

/**
 * "Central clients": searches the Capium central client service and enables a client of it for
 * this practice (`client.create`). Enabling shows what happened (created, linked to an existing
 * client, already enabled) and offers to open the client.
 */
export function CentralClientsDialog({ open, onClose }: CentralClientsDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Central clients"
      description="Clients of the Capium central client service. Enabling one adds it to this practice with its central name and address."
      size="lg"
    >
      {open ? <CentralClientsContent onClose={onClose} /> : null}
    </Modal>
  );
}
