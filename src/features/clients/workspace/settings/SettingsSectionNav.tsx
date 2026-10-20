import { Link } from 'react-router';

import { SIDEBAR_PANEL_CLASSES, sidebarLinkClasses } from '@/components/layout/sidebarClasses';

import { DEFAULT_SECTION, type SettingsSection, type SettingsSectionId } from './sections';

export interface SettingsSectionNavProps {
  sections: ReadonlyArray<SettingsSection>;
  active: SettingsSectionId;
}

/**
 * The left menu of the Settings tab, built like a module's sidebar: one item for each section, the
 * current one in soft violet; below lg a row of tabs above the section. Each item is a link to
 * `?section=…` (Billing, the first, keeps the plain URL), so Back returns to the previous section.
 */
export function SettingsSectionNav({ sections, active }: SettingsSectionNavProps) {
  return (
    <nav aria-label="Settings sections" className={`${SIDEBAR_PANEL_CLASSES} lg:w-56`}>
      <ul className="flex gap-1 lg:flex-col">
        {sections.map((section) => {
          const Icon = section.icon;
          const current = section.id === active;
          return (
            <li key={section.id} className="flex-1 lg:flex-none">
              <Link
                to={{ search: section.id === DEFAULT_SECTION ? '' : `?section=${section.id}` }}
                aria-current={current ? 'page' : undefined}
                className={sidebarLinkClasses(current, section.danger ? 'danger' : 'default')}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
