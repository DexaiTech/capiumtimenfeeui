import { NavLink } from 'react-router';

import { useShell } from '@/components/layout/shellContext';
import type { ModuleId, SubPage } from '@/constants/navigation';
import { cn } from '@/utils/cn';

const linkClasses = (active: boolean) =>
  cn(
    'flex h-9 items-center gap-2.5 rounded-md px-3 text-sm font-medium whitespace-nowrap',
    'transition-colors duration-fast ease-standard',
    active
      ? 'bg-brand-soft text-brand-text'
      : 'text-text-muted hover:bg-surface-hover hover:text-text',
  );

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
      className="shrink-0 overflow-x-auto rounded-xl border border-border bg-surface p-1.5 shadow-card lg:sticky lg:top-20 lg:w-64 lg:self-start lg:p-2"
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
                    <NavLink
                      to={page.to(slug)}
                      className={({ isActive }) => linkClasses(isActive)}
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      {page.label}
                    </NavLink>
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
