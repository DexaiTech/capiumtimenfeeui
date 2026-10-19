import { Check, Landmark, Plus } from 'lucide-react';
import { useNavigate } from 'react-router';

import { Dropdown, InitialsAvatar, type DropdownItem } from '@/components/ui';
import { routes } from '@/constants/routes';
import { initialsOf } from '@/utils/format';

import { useShell } from './shellContext';

/**
 * The practice logo circle: names the practice and the caller's role, opens the practice
 * settings and, in an open deployment, switches to another practice or creates one.
 */
export function PracticeMenu() {
  const { practice, practices, canSwitchPractice, createPracticeTo, practiceSettingsTo } =
    useShell();
  const navigate = useNavigate();
  if (!practice) return null;

  const items: DropdownItem[] = [];
  if (practiceSettingsTo) {
    const to = practiceSettingsTo;
    items.push({
      id: 'practice-settings',
      label: 'Practice settings',
      icon: <Landmark aria-hidden="true" className="size-4 text-text-muted" />,
      onSelect: () => void navigate(to),
    });
  }
  if (canSwitchPractice) {
    if (items.length > 0) items.push({ id: 'separator-practices', separator: true });
    for (const entry of practices) {
      const current = entry.slug === practice.slug;
      items.push({
        id: `practice-${entry.slug}`,
        label: entry.name,
        icon: current ? (
          <Check aria-hidden="true" className="size-4 text-brand-text" />
        ) : (
          <span aria-hidden="true" className="inline-flex">
            <InitialsAvatar name={entry.name} size="xs" />
          </span>
        ),
        onSelect: () => {
          if (!current) void navigate(routes.org.home(entry.slug));
        },
      });
    }
    if (createPracticeTo) {
      const to = createPracticeTo;
      items.push({ id: 'separator', separator: true });
      items.push({
        id: 'create',
        label: 'Create practice',
        icon: <Plus aria-hidden="true" className="size-4 text-text-muted" />,
        onSelect: () => void navigate(to),
      });
    }
  }

  return (
    <Dropdown
      label={`Practice: ${practice.name}`}
      align="end"
      items={items}
      header={
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-text">{practice.name}</span>
          <span className="truncate text-xs text-text-muted">{practice.roleName}</span>
        </div>
      }
      trigger={
        <span
          aria-hidden="true"
          className="inline-flex size-[30px] items-center justify-center rounded-full border-2 border-topbar-pill bg-topbar-chip text-[11px] font-semibold text-topbar-chip-fg"
        >
          {initialsOf(practice.name)}
        </span>
      }
    />
  );
}
