import { Link, useLocation } from 'react-router';

import { useShell } from '@/components/layout/shellContext';
import { activePageId, type ModuleId, type SubPage } from '@/constants/navigation';
import { SIDEBAR_PANEL_CLASSES, sidebarLinkClasses } from './sidebarClasses';

/**
 * A module's own left sidebar (Settings, Team & Rates): its pages grouped under headings, the
 * current one in soft violet. Below lg it becomes a row of tabs above the content, same as
 * Application Testing's sidebar.
 */
export function ModuleSidebar({ moduleId }: { moduleId: ModuleId }) {
  const { modules, practice } = useShell();
  const slug = practice?.slug ?? '';
  const module = modules.find((entry) => entry.id === moduleId);
  const pages = module?.pages ?? [];
  const { pathname } = useLocation();
  // The module's own rule for the current page, so a detail page (a job) keeps its page marked.
  const activeId = module ? activePageId(module, pathname) : null;

  const groups: Array<{ name: string | null; pages: SubPage[] }> = [];
  for (const page of pages) {
    const name = page.group ?? null;
    const last = groups.at(-1);
    if (last && last.name === name) last.pages.push(page);
    else groups.push({ name, pages: [page] });
  }

  return (
    <nav
      aria-label={`${module?.label ?? 'Module'} pages`}
      className={`${SIDEBAR_PANEL_CLASSES} lg:w-64`}
    >
      <ul className="flex gap-1 lg:flex-col">
        {groups.map((group, index) => (
          <li key={group.name ?? `ungrouped-${index}`} className="flex gap-1 lg:flex-col">
            {group.name && (
              <div className="hidden px-3 pt-2.5 pb-1 text-[11px] font-semibold tracking-wide text-text-subtle uppercase first:pt-1 lg:block">
                {group.name}
              </div>
            )}
            <ul className="flex gap-1 lg:flex-col">
              {group.pages.map((page) => {
                const Icon = page.icon;
                return (
                  <li key={page.id} className="flex-1 lg:flex-none">
                    <Link
                      to={page.to(slug)}
                      aria-current={page.id === activeId ? 'page' : undefined}
                      className={sidebarLinkClasses(page.id === activeId)}
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      {page.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
