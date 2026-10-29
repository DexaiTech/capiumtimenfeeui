import { Outlet } from 'react-router';

import type { ModuleId } from '@/constants/navigation';
import { useMediaQuery } from '@/hooks';

import { DESKTOP_QUERY } from './AppShell';
import { ModuleSidebar } from './ModuleSidebar';

/** The layout of a module with its own grouped sidebar instead of the shared secondary bar. */
export function ModuleSidebarLayout({ moduleId }: { moduleId: ModuleId }) {
  // From lg up the pages are in the left sidebar of the shell; below it they are a row of tabs.
  const desktop = useMediaQuery(DESKTOP_QUERY);
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
      {desktop ? null : <ModuleSidebar moduleId={moduleId} />}
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
