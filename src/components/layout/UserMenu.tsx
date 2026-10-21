import { LogOut, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router';

import { useThemeStore } from '@/app/store';
import { nextTheme, THEME_ICONS, THEME_LABELS } from '@/components/common/theme';
import { Dropdown, PersonAvatar, type DropdownItem } from '@/components/ui';
import type { User } from '@/types/models';
import { initialsOf } from '@/utils/format';

import { useShell } from './shellContext';

export interface UserMenuProps {
  user: User;
  onLogout: () => void;
}

/** The user circle at the far right: account, theme and sign out. */
export function UserMenu({ user, onLogout }: UserMenuProps) {
  const navigate = useNavigate();
  const { accountTo } = useShell();
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const next = nextTheme(theme);
  const ThemeIcon = THEME_ICONS[next];

  const items: DropdownItem[] = [];
  if (accountTo) {
    const to = accountTo;
    items.push({
      id: 'account',
      label: 'My account',
      icon: <UserRound className="size-4 text-text-muted" aria-hidden="true" />,
      onSelect: () => void navigate(to),
    });
  }
  items.push(
    {
      id: 'theme',
      label: `Use ${THEME_LABELS[next].toLowerCase()}`,
      icon: <ThemeIcon className="size-4 text-text-muted" aria-hidden="true" />,
      onSelect: () => setTheme(next),
    },
    { id: 'separator', separator: true },
    {
      id: 'logout',
      label: 'Log out',
      icon: <LogOut className="size-4" aria-hidden="true" />,
      tone: 'danger',
      onSelect: onLogout,
    },
  );

  return (
    <Dropdown
      label="Account menu"
      align="end"
      trigger={
        user.avatar_updated_at ? (
          <PersonAvatar
            userId={user.id}
            name={user.full_name}
            colorKey={user.id}
            pictureVersion={user.avatar_updated_at}
            size="sm"
            className="size-[30px] ring-2 ring-topbar-pill"
          />
        ) : (
          <span
            aria-hidden="true"
            className="inline-flex size-[30px] items-center justify-center rounded-full bg-topbar-pill text-[11px] font-semibold text-topbar-fg ring-2 ring-topbar-pill"
          >
            {initialsOf(user.full_name)}
          </span>
        )
      }
      header={
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-text">{user.full_name}</span>
          <span className="truncate text-xs text-text-muted">{user.email}</span>
        </div>
      }
      items={items}
    />
  );
}
