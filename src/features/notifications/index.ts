/**
 * Public surface of the notifications feature: the bell's data for the shell and the two
 * settings views. The settings pages (`features/settings/pages/`) are thin and render these;
 * the API calls, hooks and types stay inside this folder.
 */
export { useNotificationsShell } from './hooks/useNotificationsShell';
export { NotificationSettingsView } from './components/settings/NotificationSettingsView';
export { EmailTemplatesView } from './components/templates/EmailTemplatesView';
