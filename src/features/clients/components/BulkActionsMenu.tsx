import { Archive, Download, FileClock } from 'lucide-react';

import { ActionMenu, type MenuAction } from './ActionMenu';

export interface BulkActionsMenuProps {
  count: number;
  canArchive: boolean;
  onArchive: () => void;
  onExport: () => void;
}

/** The icon-only toolbar button: actions on the selected rows. */
export function BulkActionsMenu({ count, canArchive, onArchive, onExport }: BulkActionsMenuProps) {
  const items: MenuAction[] = [
    ...(canArchive
      ? [
          {
            id: 'archive',
            label: `Archive selected (${count})`,
            icon: <Archive aria-hidden="true" />,
            onSelect: onArchive,
          },
        ]
      : []),
    {
      id: 'export',
      label: `Export selected (${count})`,
      icon: <Download aria-hidden="true" />,
      onSelect: onExport,
    },
  ];
  return (
    <ActionMenu
      label={count > 0 ? `Bulk actions for ${count} selected` : 'Bulk actions (select rows first)'}
      items={items}
      triggerClassName="cc-btn cc-btn--icon"
      align="start"
      disabled={count === 0}
    >
      <FileClock aria-hidden="true" />
    </ActionMenu>
  );
}
