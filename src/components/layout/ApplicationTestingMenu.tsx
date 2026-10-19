import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { Dropdown, Tooltip, type DropdownItem } from '@/components/ui';
import { cn } from '@/utils/cn';

import { useShell } from './shellContext';

/**
 * The bug button at the start of the right-hand group of the top bar: a menu with the pages of
 * Application Testing (the practice's bug and enhancement tracker) and a shortcut to raise a
 * ticket. Shown only to people who may read tickets.
 *
 * The tooltip belongs to the round button inside the trigger, so it follows the pointer only: the
 * focus the menu hands back to the trigger when it closes must not pop it up again.
 */
export function ApplicationTestingMenu() {
  const { applicationTesting } = useShell();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (!applicationTesting) return null;

  const { label, pages, newTicketTo } = applicationTesting;
  const Trigger = applicationTesting.icon;
  const items: DropdownItem[] = pages.map((entry) => {
    const Icon = entry.icon;
    return {
      id: entry.id,
      label: entry.label,
      icon: <Icon aria-hidden="true" className="size-4 text-text-muted" />,
      onSelect: () => void navigate(entry.to),
    };
  });
  if (newTicketTo) {
    items.push(
      { id: 'separator', separator: true },
      {
        id: 'new-ticket',
        label: 'New ticket',
        icon: <Plus aria-hidden="true" className="size-4 text-text-muted" />,
        onSelect: () => void navigate(newTicketTo),
      },
    );
  }

  return (
    <Dropdown
      label={label}
      align="end"
      items={items}
      onOpenChange={setOpen}
      header={<span className="text-xs font-medium text-text-subtle">{label}</span>}
      trigger={
        <Tooltip content={label} side="bottom" disabled={open}>
          <span
            aria-hidden="true"
            className={cn(
              'inline-flex size-[30px] items-center justify-center rounded-full text-topbar-fg',
              'transition-colors duration-fast ease-standard',
              open ? 'bg-topbar-pill' : 'bg-topbar-hover hover:bg-topbar-pill',
            )}
          >
            <Trigger className="size-5" />
          </span>
        </Tooltip>
      }
    />
  );
}
