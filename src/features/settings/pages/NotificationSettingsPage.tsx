import { NotificationSettingsView } from '@/features/notifications';
import { useDocumentTitle } from '@/hooks';

import { SettingsSection } from '../components/SettingsSection';

/**
 * `/:orgSlug/settings/notifications`: which notifications you receive and how (open to every
 * member); with `organization.update` or `settings.manage` also the practice's switches and
 * defaults.
 */
export default function NotificationSettingsPage() {
  useDocumentTitle('Notification settings');
  return (
    <SettingsSection
      title="Notifications"
      description="Choose which notifications reach you and how: in the app, by email or by SMS."
    >
      <NotificationSettingsView />
    </SettingsSection>
  );
}
