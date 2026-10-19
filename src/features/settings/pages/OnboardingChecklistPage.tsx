import { PERMISSIONS as P } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';

import { ChecklistView } from '../components/onboarding/ChecklistView';
import { NoAccess, SettingsSection } from '../components/SettingsSection';

/**
 * `/:orgSlug/settings/onboarding`: the steps to get the practice up and running. Every member
 * reads it; `onboarding.manage` marks the steps.
 */
export default function OnboardingChecklistPage() {
  const { can } = useOrg();
  useDocumentTitle('Onboarding checklist');
  return (
    <SettingsSection
      title="Onboarding Checklist"
      description="The steps to get your practice up and running."
    >
      {can(P.organizationRead) ? <ChecklistView /> : <NoAccess what="the onboarding checklist" />}
    </SettingsSection>
  );
}
