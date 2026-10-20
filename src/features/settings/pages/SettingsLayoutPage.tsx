import { ModuleSidebarLayout } from '@/components/layout/ModuleSidebarLayout';

/** The layout of Settings: its own grouped sidebar instead of the shared secondary bar. */
export default function SettingsLayoutPage() {
  return <ModuleSidebarLayout moduleId="settings" />;
}
