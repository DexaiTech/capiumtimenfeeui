import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';

import { OwnPreferences } from './OwnPreferences';
import { PracticeDefaults } from './PracticeDefaults';

/**
 * The content of Settings → Notifications: the person's own choices for everyone, and the
 * practice's switches and defaults for those who may change them (`organization.update` or
 * `settings.manage`); the second card is not rendered, and not asked for, for anyone else.
 */
export function NotificationSettingsView() {
  const { can } = useOrg();
  const canManagePractice = can(PERMISSIONS.organizationUpdate) || can(PERMISSIONS.settingsManage);
  return (
    <>
      <OwnPreferences />
      {canManagePractice ? <PracticeDefaults /> : null}
    </>
  );
}
