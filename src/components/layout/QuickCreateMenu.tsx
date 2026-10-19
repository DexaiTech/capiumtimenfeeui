import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router';

import { Dropdown, type DropdownItem } from '@/components/ui';

import { useShell } from './shellContext';

/** The "+" white circle: shortcuts to create what the caller may create. */
export function QuickCreateMenu() {
  const { quickCreate } = useShell();
  const navigate = useNavigate();
  if (quickCreate.length === 0) return null;

  const items: DropdownItem[] = quickCreate.map((item) => {
    const Icon = item.icon;
    return {
      id: item.id,
      label: item.label,
      icon: <Icon aria-hidden="true" className="size-4 text-text-muted" />,
      onSelect: () => void navigate(item.to),
    };
  });

  return (
    <Dropdown
      label="Create new"
      align="end"
      items={items}
      header={<span className="text-xs font-medium text-text-subtle">Create new</span>}
      trigger={
        <span
          aria-hidden="true"
          className="inline-flex size-[30px] items-center justify-center rounded-full bg-topbar-chip text-topbar-chip-fg shadow-sm transition-shadow duration-fast ease-standard hover:shadow-md"
        >
          <Plus className="size-3.5" />
        </span>
      }
    />
  );
}
