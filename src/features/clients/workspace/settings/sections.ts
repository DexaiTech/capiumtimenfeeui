import {
  Briefcase,
  Link2,
  PoundSterling,
  Receipt,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';

import type { ClientAbilities } from '../abilities';

export type SettingsSectionId = 'billing' | 'team' | 'services' | 'rates' | 'central' | 'danger';

export interface SettingsSection {
  id: SettingsSectionId;
  label: string;
  icon: LucideIcon;
  /** Drawn in the danger colour (archive). */
  danger?: boolean;
  /** Whether the section has anything to show: the same checks as its card. */
  visible: (abilities: ClientAbilities) => boolean;
}

/** The sections of a client's Settings tab, in the order of the left menu. */
export const SETTINGS_SECTIONS: ReadonlyArray<SettingsSection> = [
  { id: 'billing', label: 'Billing', icon: Receipt, visible: () => true },
  { id: 'team', label: 'Team', icon: Users, visible: () => true },
  { id: 'services', label: 'Services', icon: Briefcase, visible: () => true },
  { id: 'rates', label: 'Rate overrides', icon: PoundSterling, visible: (a) => a.seeRates },
  { id: 'central', label: 'Central client', icon: Link2, visible: () => true },
  {
    id: 'danger',
    label: 'Danger zone',
    icon: TriangleAlert,
    danger: true,
    visible: (a) => a.archive || a.restore,
  },
];

export const DEFAULT_SECTION: SettingsSectionId = 'billing';

/** The sections this caller may see, in menu order. */
export function visibleSections(abilities: ClientAbilities): SettingsSection[] {
  return SETTINGS_SECTIONS.filter((section) => section.visible(abilities));
}

/** The section named by the URL, or the first one when it is unknown or hidden. */
export function sectionFromParam(
  param: string | null,
  sections: ReadonlyArray<SettingsSection>,
): SettingsSectionId {
  return sections.find((section) => section.id === param)?.id ?? DEFAULT_SECTION;
}
