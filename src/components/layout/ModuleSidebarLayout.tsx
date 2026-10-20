import { Outlet } from 'react-router';

import type { ModuleId } from '@/constants/navigation';

import { ModuleSidebar } from './ModuleSidebar';

/** The layout of a module with its own grouped sidebar instead of the shared secondary bar. */
export function ModuleSidebarLayout({ moduleId }: { moduleId: ModuleId }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
      <ModuleSidebar moduleId={moduleId} />
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
