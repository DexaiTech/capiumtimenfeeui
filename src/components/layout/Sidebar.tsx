import {
  ChevronRight,
  CircleQuestionMark,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';

import { useShellStore } from '@/app/store';
import { LogoMark } from '@/components/common/Logo';
import { Tooltip } from '@/components/ui';
import { activePageId, moduleIdForPath } from '@/constants/navigation';
import { ORG_SEGMENTS, routes } from '@/constants/routes';
import { cn } from '@/utils/cn';

import { useShell } from './shellContext';

/** Modules that sit apart, under a divider, at the foot of the list (the setup of the practice). */
const FOOT_MODULES: ReadonlyArray<string> = ['team', 'settings'];

const rowClasses = (active: boolean, collapsed: boolean) =>
  cn(
    'group relative flex h-10 w-full items-center rounded-lg text-sm font-medium whitespace-nowrap',
    'transition-colors duration-fast ease-standard',
    collapsed ? 'justify-center' : 'gap-3 px-3',
    active
      ? 'bg-brand-soft text-brand-text shadow-[inset_3px_0_0_0_var(--module-accent,var(--color-brand))]'
      : 'text-text-muted hover:bg-surface-hover hover:text-text',
  );

const subRowClasses = (active: boolean) =>
  cn(
    'flex h-9 items-center rounded-md px-3 text-[13px] font-medium whitespace-nowrap',
    'transition-colors duration-fast ease-standard',
    active
      ? 'bg-brand-soft text-brand-text'
      : 'text-text-muted hover:bg-surface-hover hover:text-text',
  );

interface GroupProps {
  id: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
  /** Where the group leads when the sidebar is collapsed (there are no sub-pages to open). */
  href: string;
  children: ReactNode;
}

/** A module with pages: a row that opens its list (expanded), or leads to its first page (icons). */
function Group({
  id,
  label,
  icon: Icon,
  active,
  collapsed,
  open,
  onToggle,
  href,
  children,
}: GroupProps) {
  if (collapsed) {
    return (
      <Tooltip content={label} side="right" className="flex w-full">
        <Link
          to={href}
          aria-label={label}
          aria-current={active ? 'true' : undefined}
          className={rowClasses(active, true)}
        >
          <Icon aria-hidden="true" className="size-5" />
        </Link>
      </Tooltip>
    );
  }
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`sidebar-${id}`}
        onClick={onToggle}
        className={rowClasses(active, false)}
      >
        <Icon aria-hidden="true" className="size-5 shrink-0" />
        <span className="flex-1 truncate text-left">{label}</span>
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0 text-text-subtle transition-transform duration-fast ease-standard',
            open && 'rotate-90',
          )}
        />
      </button>
      {open ? (
        <ul
          id={`sidebar-${id}`}
          className="mt-0.5 mb-1 ml-[1.35rem] flex flex-col gap-0.5 border-l border-border pl-2.5"
        >
          {children}
        </ul>
      ) : null}
    </>
  );
}

/**
 * The left navigation from lg up: the practice's modules, each opening its pages, under the
 * product mark. It collapses to a column of icons (remembered between visits) and opens the
 * module the caller is in. Below lg the drawer takes its place.
 */
export function Sidebar() {
  const { practice, modules, homeTo, applicationTesting } = useShell();
  const collapsed = useShellStore((state) => state.sidebarCollapsed);
  const setCollapsed = useShellStore((state) => state.setSidebarCollapsed);
  const { pathname } = useLocation();
  const activeId = moduleIdForPath(pathname);
  const inTracker = pathname.split('/')[2] === ORG_SEGMENTS.applicationTesting;
  // One module is open at a time: the one the caller is in until they open another.
  const [pick, setPick] = useState<{ path: string; id: string | null } | null>(null);
  const section = pathname.split('/').slice(0, 3).join('/');
  const defaultOpen = inTracker ? 'application-testing' : activeId;
  // A choice holds for the module it was made in; moving to another one follows the page again.
  const openId = pick && pick.path === section ? pick.id : defaultOpen;
  const toggle = (id: string) => setPick({ path: section, id: openId === id ? null : id });

  const slug = practice?.slug ?? '';
  const main = modules.filter((module) => !FOOT_MODULES.includes(module.id));
  const foot = modules.filter((module) => FOOT_MODULES.includes(module.id));

  const renderModule = (module: (typeof modules)[number]) => {
    const Icon = module.icon;
    const active = module.id === activeId;
    if (module.pages.length < 2) {
      const link = (
        <NavLink
          to={module.href}
          aria-label={collapsed ? module.label : undefined}
          className={rowClasses(active, collapsed)}
        >
          <Icon aria-hidden="true" className="size-5 shrink-0" />
          {collapsed ? null : <span className="truncate">{module.label}</span>}
        </NavLink>
      );
      return (
        <li key={module.id}>
          {collapsed ? (
            <Tooltip content={module.label} side="right" className="flex w-full">
              {link}
            </Tooltip>
          ) : (
            link
          )}
        </li>
      );
    }
    const currentPage = active ? activePageId(module, pathname) : null;
    return (
      <li key={module.id}>
        <Group
          id={module.id}
          label={module.label}
          icon={module.icon}
          active={active}
          collapsed={collapsed}
          open={openId === module.id}
          onToggle={() => toggle(module.id)}
          href={module.href}
        >
          {module.pages.map((page) => (
            <li key={page.id}>
              <NavLink
                to={practice ? page.to(slug) : '#'}
                title={page.description}
                aria-current={page.id === currentPage ? 'page' : undefined}
                className={subRowClasses(page.id === currentPage)}
              >
                {page.label}
              </NavLink>
            </li>
          ))}
        </Group>
      </li>
    );
  };

  return (
    <aside
      aria-label="Sidebar"
      className={cn(
        'sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface',
        'transition-[width] duration-base ease-standard lg:flex',
        collapsed ? 'w-[4.5rem]' : 'w-64',
      )}
    >
      <div
        className={cn(
          'flex h-15 shrink-0 items-center border-b border-border',
          collapsed ? 'justify-center' : 'justify-between gap-2 pr-3 pl-4',
        )}
      >
        {collapsed ? null : (
          <Link
            to={homeTo}
            className="flex min-w-0 items-center gap-2.5"
            aria-label="Capium Time & Fees home"
          >
            <LogoMark />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-bold text-text">Capium</span>
              <span className="truncate text-2xs font-medium tracking-wide text-text-muted uppercase">
                Time &amp; Fees
              </span>
            </span>
          </Link>
        )}
        <button
          type="button"
          aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-muted shadow-sm transition-colors duration-fast hover:bg-surface-hover hover:text-text"
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" className="size-4.5" />
          ) : (
            <PanelLeftClose aria-hidden="true" className="size-4.5" />
          )}
        </button>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-x-hidden overflow-y-auto p-3">
        <ul className="flex flex-col gap-1">{main.map(renderModule)}</ul>
        {foot.length > 0 || applicationTesting ? (
          <ul className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
            {foot.map(renderModule)}
            {applicationTesting ? (
              <li key="application-testing">
                <Group
                  id="application-testing"
                  label={applicationTesting.label}
                  icon={applicationTesting.icon}
                  active={inTracker}
                  collapsed={collapsed}
                  open={openId === 'application-testing'}
                  onToggle={() => toggle('application-testing')}
                  href={applicationTesting.pages[0]?.to ?? homeTo}
                >
                  {applicationTesting.pages.map((page) => (
                    <li key={page.id}>
                      <NavLink to={page.to} className={({ isActive }) => subRowClasses(isActive)}>
                        {page.label}
                      </NavLink>
                    </li>
                  ))}
                </Group>
              </li>
            ) : null}
            {practice ? (
              <li key="help">
                {collapsed ? (
                  <Tooltip content="Help" side="right" className="flex w-full">
                    <NavLink
                      to={routes.org.help(practice.slug)}
                      aria-label="Help"
                      className={({ isActive }) => rowClasses(isActive, true)}
                    >
                      <CircleQuestionMark aria-hidden="true" className="size-5" />
                    </NavLink>
                  </Tooltip>
                ) : (
                  <NavLink
                    to={routes.org.help(practice.slug)}
                    className={({ isActive }) => rowClasses(isActive, false)}
                  >
                    <CircleQuestionMark aria-hidden="true" className="size-5 shrink-0" />
                    Help
                  </NavLink>
                )}
              </li>
            ) : null}
          </ul>
        ) : null}
      </nav>
    </aside>
  );
}
