import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react';
import { NavLink, useLocation } from 'react-router';

import { useShellStore } from '@/app/store';
import { Tooltip } from '@/components/ui';
import { activePageId, moduleIdForPath, NO_SUBNAV_MODULES } from '@/constants/navigation';
import { ORG_SEGMENTS } from '@/constants/routes';
import { cn } from '@/utils/cn';

import { useShell } from './shellContext';

interface SidebarPage {
  id: string;
  label: string;
  icon: LucideIcon;
  to: string;
  description?: string;
  group?: string;
}

const rowClasses = (active: boolean, collapsed: boolean) =>
  cn(
    'group relative flex h-10 w-full items-center rounded-lg text-sm font-medium whitespace-nowrap',
    'transition-colors duration-fast ease-standard',
    collapsed ? 'justify-center' : 'gap-3 px-3',
    active
      ? 'bg-topbar-pill text-topbar-fg shadow-[inset_3px_0_0_0_var(--module-accent,var(--color-topbar-fg))]'
      : 'text-topbar-muted hover:bg-topbar-hover hover:text-topbar-fg',
  );

/** Pages in runs of the same group, so a group's heading is written once. */
function grouped(pages: ReadonlyArray<SidebarPage>) {
  const groups: Array<{ name: string | null; pages: SidebarPage[] }> = [];
  for (const page of pages) {
    const name = page.group ?? null;
    const last = groups.at(-1);
    if (last && last.name === name) last.pages.push(page);
    else groups.push({ name, pages: [page] });
  }
  return groups;
}

/**
 * The left menu from lg up: the pages of the module the caller is in (the modules themselves are
 * the tabs of the top bar), or of Application Testing. It collapses to a column of icons
 * (remembered between visits). Modules with a single page have no sidebar. Below lg the pages
 * are a row of tabs above the content instead.
 */
export function Sidebar() {
  const { practice, modules, applicationTesting } = useShell();
  const collapsed = useShellStore((state) => state.sidebarCollapsed);
  const setCollapsed = useShellStore((state) => state.setSidebarCollapsed);
  const { pathname } = useLocation();
  const slug = practice?.slug ?? '';
  const inTracker = pathname.split('/')[2] === ORG_SEGMENTS.applicationTesting;
  const module = modules.find((entry) => entry.id === moduleIdForPath(pathname));

  let title: string;
  let pages: SidebarPage[];
  let currentId: string | null;
  if (inTracker && applicationTesting) {
    title = applicationTesting.label;
    pages = applicationTesting.pages.map((page) => ({ ...page }));
    currentId = pages.find((page) => pathname.startsWith(page.to))?.id ?? null;
  } else if (module && !NO_SUBNAV_MODULES.includes(module.id) && slug) {
    title = module.label;
    pages = module.pages.map((page) => ({
      id: page.id,
      label: page.label,
      icon: page.icon,
      to: page.to(slug),
      description: page.description,
      group: page.group,
    }));
    currentId = activePageId(module, pathname);
  } else {
    return null;
  }
  if (pages.length < 2) return null;

  return (
    <aside
      aria-label="Sidebar"
      className={cn(
        'sticky top-15 z-20 hidden h-[calc(100dvh-3.75rem)] shrink-0 flex-col',
        'bg-gradient-sidebar bg-topbar text-topbar-fg shadow-md',
        'transition-[width] duration-base ease-standard lg:flex',
        collapsed ? 'w-[4.5rem]' : 'w-60',
      )}
    >
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-white/10',
          collapsed ? 'justify-center' : 'justify-between gap-2 pr-3 pl-4',
        )}
      >
        {collapsed ? null : (
          <span className="truncate text-sm font-bold text-topbar-fg">{title}</span>
        )}
        <button
          type="button"
          aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-topbar-hover text-topbar-fg transition-colors duration-fast hover:bg-topbar-pill"
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" className="size-4.5" />
          ) : (
            <PanelLeftClose aria-hidden="true" className="size-4.5" />
          )}
        </button>
      </div>

      <nav aria-label={`${title} pages`} className="flex-1 overflow-x-hidden overflow-y-auto p-3">
        <ul className="flex flex-col gap-1">
          {grouped(pages).map((group, index) => (
            <li key={group.name ?? `ungrouped-${index}`}>
              {group.name && !collapsed ? (
                <div className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-topbar-subtle uppercase">
                  {group.name}
                </div>
              ) : index > 0 ? (
                <div className="mx-2 my-2 border-t border-white/15" />
              ) : null}
              <ul className="flex flex-col gap-1">
                {group.pages.map((page) => {
                  const Icon = page.icon;
                  const active = page.id === currentId;
                  const link = (
                    <NavLink
                      to={page.to}
                      title={collapsed ? undefined : page.description}
                      aria-label={collapsed ? page.label : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={rowClasses(active, collapsed)}
                    >
                      <Icon aria-hidden="true" className="size-5 shrink-0" />
                      {collapsed ? null : <span className="truncate">{page.label}</span>}
                    </NavLink>
                  );
                  return (
                    <li key={page.id}>
                      {collapsed ? (
                        <Tooltip content={page.label} side="right" className="flex w-full">
                          {link}
                        </Tooltip>
                      ) : (
                        link
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
