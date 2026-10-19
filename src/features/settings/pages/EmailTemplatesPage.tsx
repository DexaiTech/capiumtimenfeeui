import { PERMISSIONS } from '@/constants/permissions';
import { EmailTemplatesView } from '@/features/notifications';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';

import { NoAccess, SettingsSection } from '../components/SettingsSection';

/**
 * `/:orgSlug/settings/email-templates`: the emails the application sends, with merge fields and
 * a preview. Needs `organization.update` or `settings.manage`.
 */
export default function EmailTemplatesPage() {
  const { can } = useOrg();
  useDocumentTitle('Email templates');
  const allowed = can(PERMISSIONS.organizationUpdate) || can(PERMISSIONS.settingsManage);
  return (
    <SettingsSection
      title="Email Templates"
      description="The emails the application sends. Change the wording with merge fields and check it in the preview before saving."
    >
      {allowed ? <EmailTemplatesView /> : <NoAccess what="the email templates" />}
    </SettingsSection>
  );
}
