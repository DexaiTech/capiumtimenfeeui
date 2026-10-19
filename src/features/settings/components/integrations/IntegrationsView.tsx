import { useRef, useState } from 'react';

import { Card, Skeleton, Tabs } from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';

import { useIntegrations } from '../../api/adminHooks';
import type { IntegrationKey } from '../../adminTypes';
import { LoadError } from '../LoadError';
import { IntegrationCardView } from './IntegrationCardView';
import { MappingsDialog } from './MappingsDialog';
import { SyncItemsPanel } from './SyncItemsPanel';
import { SyncLogPanel } from './SyncLogPanel';

type Tab = 'items' | 'logs';

const TABS = [
  { value: 'items', label: 'Sync items' },
  { value: 'logs', label: 'Sync log' },
] as const;

function IntegrationsSkeleton() {
  return (
    <div role="status" aria-label="Loading the integrations" className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} shape="rect" className="h-72 w-full" />
      ))}
    </div>
  );
}

/** The connections to other systems, what is queued for them, and the log of every attempt. */
export function IntegrationsView() {
  const { can } = useOrg();
  const cards = useIntegrations();
  const canManage = can(P.integrationManage);
  const [tab, setTab] = useState<Tab>('items');
  const [integration, setIntegration] = useState<IntegrationKey | ''>('');
  const [mappingsOpen, setMappingsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  if (cards.isPending) return <IntegrationsSkeleton />;
  if (cards.isError && !cards.data) {
    return (
      <LoadError
        title="Could not load the integrations"
        error={cards.error}
        onRetry={() => void cards.refetch()}
        retrying={cards.isRefetching}
      />
    );
  }

  const showItems = (key: IntegrationKey) => {
    setTab('items');
    setIntegration(key);
    panelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {(cards.data ?? []).map((card) => (
          <IntegrationCardView
            key={card.key}
            card={card}
            canManage={canManage}
            onOpenMappings={() => setMappingsOpen(true)}
            onShowItems={() => showItems(card.key)}
          />
        ))}
      </div>
      {canManage ? null : (
        <p className="text-sm text-text-muted">
          Switching integrations on and off, running them and changing their settings needs
          permission to manage integrations.
        </p>
      )}

      <div ref={panelRef}>
        <Card padding="lg" className="flex flex-col gap-4">
          <Tabs
            label="Integration activity"
            idBase="integration-activity"
            items={TABS}
            value={tab}
            onChange={setTab}
          />
          <div
            role="tabpanel"
            id={`integration-activity-panel-${tab}`}
            aria-labelledby={`integration-activity-tab-${tab}`}
          >
            {tab === 'items' ? (
              <SyncItemsPanel
                integration={integration}
                onIntegrationChange={setIntegration}
                canManage={canManage}
              />
            ) : (
              <SyncLogPanel integration={integration} onIntegrationChange={setIntegration} />
            )}
          </div>
        </Card>
      </div>

      <MappingsDialog
        open={mappingsOpen}
        onClose={() => setMappingsOpen(false)}
        canManage={canManage}
      />
    </>
  );
}
