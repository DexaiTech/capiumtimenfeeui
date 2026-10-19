import { useMemo } from 'react';
import { useLocation } from 'react-router';

import { activePageId, moduleIdForPath } from '@/constants/navigation';

import { OverflowNav } from './OverflowNav';
import { useShell } from './shellContext';

/**
 * The white secondary bar under the violet bar: the pages of the module the caller is in,
 * centred. Hidden when the module has fewer than two pages the caller may open.
 */
export function SubNav() {
  const { practice, modules } = useShell();
  const { pathname } = useLocation();
  const module = modules.find((entry) => entry.id === moduleIdForPath(pathname));
  const slug = practice?.slug;
  const items = useMemo(
    () =>
      slug && module
        ? module.pages.map((entry) => ({
            id: entry.id,
            label: entry.label,
            icon: entry.icon,
            to: entry.to(slug),
            group: entry.group,
          }))
        : [],
    [slug, module],
  );

  if (!module || items.length < 2) return null;

  return (
    <div className="sticky top-15 z-20 hidden border-b border-border bg-surface lg:block">
      <div className="flex min-h-11 w-full items-center px-6 py-1.5 2xl:px-8">
        <OverflowNav
          label={`${module.label} pages`}
          items={items}
          activeId={activePageId(module, pathname)}
          variant="subnav"
          className="w-full"
        />
      </div>
    </div>
  );
}
