import { NavLink } from 'react-router';

import { APPLICATION_TESTING_LABEL, APPLICATION_TESTING_PAGES } from '@/constants/navigation';
import { useOrg } from '@/features/organizations';
import { cn } from '@/utils/cn';

const linkClasses = (active: boolean) =>
  cn(
    'flex h-11 items-center gap-2.5 rounded-md px-3 text-xs font-medium whitespace-nowrap lg:h-9',
    'transition-colors duration-fast ease-standard',
    active
      ? 'bg-brand-soft text-brand-text'
      : 'text-text-muted hover:bg-surface-hover hover:text-text',
  );

/**
 * The sidebar of Application Testing: Dashboard and All Tickets, the current one in soft violet.
 * From lg up it is a narrow white panel that stays under the top bar; below it, a row of tabs
 * above the content.
 */
export function TicketsSidebar() {
  const { organization } = useOrg();
  return (
    <nav
      aria-label={`${APPLICATION_TESTING_LABEL} pages`}
      className="shrink-0 overflow-x-auto rounded-xl border border-border bg-surface p-1.5 shadow-card lg:sticky lg:top-20 lg:w-44 lg:self-start lg:p-2"
    >
      <ul className="flex gap-1 lg:flex-col">
        {APPLICATION_TESTING_PAGES.map((page) => {
          const Icon = page.icon;
          return (
            <li key={page.id} className="flex-1 lg:flex-none">
              <NavLink
                to={page.to(organization.slug)}
                className={({ isActive }) => linkClasses(isActive)}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                {page.label}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
