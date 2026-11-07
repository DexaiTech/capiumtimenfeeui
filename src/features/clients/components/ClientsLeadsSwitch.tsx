import { Target, Users } from 'lucide-react';
import { Link } from 'react-router';

import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';

/**
 * The Clients | Leads tabs at the top of the Client List and of Leads. Clients has no sidebar, so
 * both pages carry the same switch: the current one is marked, the other is a link.
 */
export function ClientsLeadsSwitch({
  current,
  clientCount,
  leadCount,
}: {
  current: 'clients' | 'leads';
  /** null: still loading ("–"); undefined: no count on that tab. */
  clientCount?: number | null | undefined;
  leadCount?: number | null | undefined;
}) {
  const { organization } = useOrg();
  const tabs = [
    {
      id: 'clients' as const,
      label: 'Clients',
      icon: Users,
      to: routes.org.clients(organization.slug),
      count: clientCount,
    },
    {
      id: 'leads' as const,
      label: 'Leads',
      icon: Target,
      to: routes.org.leads(organization.slug),
      count: leadCount,
    },
  ];
  return (
    <nav className="cc-tabswitch" aria-label="Clients and leads">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const body = (
          <>
            <Icon aria-hidden="true" />
            {tab.label}
            {tab.count === undefined ? null : <span className="cc-count">{tab.count ?? '–'}</span>}
          </>
        );
        return tab.id === current ? (
          <span key={tab.id} className="cc-tab" aria-current="true">
            {body}
          </span>
        ) : (
          <Link key={tab.id} className="cc-tab no-underline" to={tab.to}>
            {body}
          </Link>
        );
      })}
    </nav>
  );
}
