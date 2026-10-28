import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';

import { PracticeSettingsForm } from '../components/practice/PracticeSettingsForm';
import { SettingsSection } from '../components/SettingsSection';

/** `/:orgSlug/settings/practice`: the practice's details and billing settings. */
export default function PracticeSettingsPage() {
  const { organization, can } = useOrg();
  useDocumentTitle('Practice settings');
  const editable = can(PERMISSIONS.organizationUpdate);

  return (
    <SettingsSection
      title="Practice"
      description="Details, address, billing and invoice settings of the practice."
    >
      {/* Remount when the saved values change elsewhere, so the form never shows stale defaults. */}
      <PracticeSettingsForm
        key={JSON.stringify(organization)}
        organization={organization}
        editable={editable}
      />
    </SettingsSection>
  );
}
