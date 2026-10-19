import { PERMISSIONS as P } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';

import { IntegrationsView } from '../components/integrations/IntegrationsView';
import { NoAccess, SettingsSection } from '../components/SettingsSection';

/**
 * `/:orgSlug/settings/integrations`: the central client and user directories, practice management
 * and bookkeeping. `integration.read` shows them; `integration.manage` runs and changes them.
 */
export default function IntegrationsPage() {
  const { can } = useOrg();
  useDocumentTitle('Integrations');
  return (
    <SettingsSection
      title="Integrations"
      description="Central client and user, practice management and bookkeeping connections."
    >
      {can(P.integrationRead) ? <IntegrationsView /> : <NoAccess what="the integrations" />}
    </SettingsSection>
  );
}
