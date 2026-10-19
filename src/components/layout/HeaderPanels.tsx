import { Bell, CircleQuestionMark, Keyboard } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { EmptyState, Popover, Tooltip } from '@/components/ui';
import { cn } from '@/utils/cn';

import { badgeCount, bellLabel } from './notificationBadge';
import { NotificationsPanel } from './NotificationsPanel';
import { useShell, type ShellNotification } from './shellContext';

const barIcon =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-topbar-hover text-topbar-fg ' +
  'transition-colors duration-fast ease-standard hover:bg-topbar-pill md:size-[30px]';

/** The help icon: how to find your way around. */
export function HelpMenu() {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Tooltip content="Help" side="bottom" disabled={open}>
        <button
          ref={anchorRef}
          type="button"
          aria-label="Help"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((value) => !value)}
          className={cn(barIcon, open && 'bg-topbar-pill')}
        >
          <CircleQuestionMark aria-hidden="true" className="size-5" />
        </button>
      </Tooltip>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        label="Help"
        align="end"
        className="w-72 p-4"
      >
        <div className="flex flex-col gap-3 text-sm">
          <p className="font-semibold text-text">Help</p>
          <p className="text-text-muted">
            The violet bar at the top holds the modules your role can open; the white bar under it
            the pages of the module you are in.
          </p>
          <p className="flex items-center gap-2 text-text-muted">
            <Keyboard aria-hidden="true" className="size-4 shrink-0" />
            <span>
              Press <kbd className="rounded-sm border border-border px-1 font-mono text-xs">/</kbd>{' '}
              to search for a page.
            </span>
          </p>
          <p className="text-text-muted">
            Missing something? Your practice administrator decides what each role can see.
          </p>
        </div>
      </Popover>
    </>
  );
}

/**
 * The bell: the number of unread notifications on a badge and, when opened, the person's
 * notifications (newest first). Without notification data (outside a wired shell) it says there
 * are none.
 */
export function NotificationsMenu() {
  const { notifications } = useShell();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const unreadCount = notifications?.unreadCount ?? 0;

  const setPanel = (next: boolean) => {
    setOpen(next);
    notifications?.onOpenChange(next);
  };

  const choose = (item: ShellNotification) => {
    notifications?.onSelect(item);
    setPanel(false);
    if (item.to) void navigate(item.to);
  };

  return (
    <>
      <Tooltip content="Notifications" side="bottom" disabled={open}>
        <button
          ref={anchorRef}
          type="button"
          aria-label={bellLabel(unreadCount)}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setPanel(!open)}
          className={cn(barIcon, 'relative', open && 'bg-topbar-pill')}
        >
          <Bell aria-hidden="true" className="size-5" />
          {unreadCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-danger-solid px-1 text-[10px] leading-none font-semibold text-white ring-2 ring-topbar"
            >
              {badgeCount(unreadCount)}
            </span>
          ) : null}
        </button>
      </Tooltip>
      <Popover
        open={open}
        onClose={() => setPanel(false)}
        anchorRef={anchorRef}
        label="Notifications"
        align="end"
        className="w-[22rem]"
      >
        {notifications ? (
          <NotificationsPanel
            data={notifications}
            onSelect={choose}
            onClose={() => setPanel(false)}
          />
        ) : (
          <EmptyState
            icon={<Bell className="size-5" />}
            title="You're all caught up"
            description="Timesheet approvals, overdue invoices and other alerts will appear here."
            className="py-8"
          />
        )}
      </Popover>
    </>
  );
}
