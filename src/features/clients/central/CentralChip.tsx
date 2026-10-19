import { Link2, Link2Off } from 'lucide-react';

import { Badge, type BadgeTone } from '@/components/ui';
import { useOrg } from '@/features/organizations';

import type { ClientRead } from '../types';
import { centralChip, type CentralTone } from './format';

const TONES: Record<CentralTone, BadgeTone> = {
  success: 'green',
  warning: 'amber',
  danger: 'red',
  neutral: 'grey',
};

export interface CentralChipProps {
  client: Pick<ClientRead, 'central_client_id' | 'central_sync_state' | 'central_synced_at'>;
}

/** `Local`, `Linked`, `Synced dd/MM/yyyy`, `Stale` or `Not found centrally`, as a pill. */
export function CentralChip({ client }: CentralChipProps) {
  const { organization } = useOrg();
  const info = centralChip(client, organization.timezone);
  const Icon = client.central_client_id ? Link2 : Link2Off;
  return (
    <span title={info.title}>
      <Badge
        tone={TONES[info.tone]}
        size="sm"
        icon={<Icon aria-hidden="true" className="size-3" />}
      >
        {info.label}
      </Badge>
    </span>
  );
}
