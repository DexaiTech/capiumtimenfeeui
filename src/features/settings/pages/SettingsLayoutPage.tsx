import { Outlet } from 'react-router';

import { SettingsSidebar } from '../components/SettingsSidebar';

/**
 * The layout of Settings: its own grouped sidebar (Practice, Access control, Money & tax, ...)
 * instead of the shared secondary bar every other module uses.
 */
export default function SettingsLayoutPage() {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
      <SettingsSidebar />
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
