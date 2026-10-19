import { useNavigate } from 'react-router';

import { CountTabs } from '@/components/ui';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';

import type { ClientTabDef } from './constants';
import type { ClientTabId, TabCounts } from './types';

export interface ClientTabsProps {
  clientId: string;
  /** The tabs the caller may open. */
  tabs: ReadonlyArray<ClientTabDef>;
  active: ClientTabId;
  /** From the overview; the badges are left out until it has loaded. */
  counts: TabCounts | undefined;
}

/**
 * The tabs of the client workspace. The active one is the last segment of the URL, so each tab
 * can be bookmarked and shared; choosing one navigates (`/clients/:id/<tab>`).
 */
export function ClientTabs({ clientId, tabs, active, counts }: ClientTabsProps) {
  const { organization } = useOrg();
  const navigate = useNavigate();
  return (
    <CountTabs
      label="Client sections"
      value={active}
      items={tabs.map((tab) => ({
        value: tab.id,
        label: tab.label,
        count: counts && tab.count ? tab.count(counts) : undefined,
      }))}
      onChange={(id) => void navigate(routes.org.client(organization.slug, clientId, id))}
      className="self-start"
    />
  );
}
