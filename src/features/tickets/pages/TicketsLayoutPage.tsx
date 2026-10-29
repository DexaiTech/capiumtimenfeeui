import { Outlet } from 'react-router';

import { DESKTOP_QUERY } from '@/components/layout/AppShell';
import { useMediaQuery } from '@/hooks';

import { TicketsSidebar } from '../components/TicketsSidebar';

/**
 * The layout of Application Testing: its own sidebar and the page. It is not one of the ten
 * modules, so the top bar highlights none and there is no secondary bar here.
 */
export default function TicketsLayoutPage() {
  // From lg up Application Testing's pages are in the shell's left sidebar.
  const desktop = useMediaQuery(DESKTOP_QUERY);
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
      {desktop ? null : <TicketsSidebar />}
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
