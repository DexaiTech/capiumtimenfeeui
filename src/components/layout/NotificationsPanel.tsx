import {
  Banknote,
  Bell,
  CheckCheck,
  ClipboardCheck,
  Clock,
  Gauge,
  Send,
  Settings,
  TriangleAlert,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router';

import { Button, buttonClasses, EmptyState, Skeleton } from '@/components/ui';
import { cn } from '@/utils/cn';
import { formatRelativeTime } from '@/utils/format';

import type { ShellNotification, ShellNotifications } from './shellContext';

/** The icon of each notification type of the catalogue; a type the UI does not know gets the bell. */
const TYPE_ICONS: Record<string, LucideIcon> = {
  timesheet_reminder: Clock,
  timesheet_returned: Undo2,
  approval_pending: ClipboardCheck,
  budget_alert: Gauge,
  invoice_delivery: Send,
  payment_reminder: Banknote,
  failed_job: TriangleAlert,
};

function NotificationRow({
  item,
  onSelect,
}: {
  item: ShellNotification;
  onSelect: (item: ShellNotification) => void;
}) {
  const Icon = TYPE_ICONS[item.type] ?? Bell;
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(item)}
        className={cn(
          'flex min-h-11 w-full items-start gap-3 px-4 py-3 text-left',
          'transition-colors duration-fast ease-standard hover:bg-surface-hover focus-visible:bg-surface-hover',
          !item.read && 'bg-primary-soft/40',
        )}
      >
        <span
          aria-hidden="true"
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-text"
        >
          <Icon className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn('text-sm text-text', item.read ? 'font-medium' : 'font-semibold')}>
            {item.read ? null : <span className="sr-only">Unread: </span>}
            {item.title}
          </span>
          <span className="line-clamp-2 text-xs text-text-muted">{item.body}</span>
          <span className="text-2xs text-text-subtle">{formatRelativeTime(item.createdAt)}</span>
        </span>
        {item.read ? null : (
          <span
            aria-hidden="true"
            data-testid="unread-dot"
            className="mt-2 size-2 shrink-0 rounded-full bg-primary"
          />
        )}
      </button>
    </li>
  );
}

function LoadingRows() {
  return (
    <div role="status" aria-label="Loading notifications" className="flex flex-col gap-4 p-4">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-start gap-3">
          <Skeleton shape="circle" className="size-8 shrink-0" />
          <Skeleton lines={2} className="flex-1" />
        </div>
      ))}
    </div>
  );
}

export interface NotificationsPanelProps {
  data: ShellNotifications;
  /** The person chose a notification: the bell marks it read, closes and navigates. */
  onSelect: (item: ShellNotification) => void;
  onClose: () => void;
}

/** The content of the bell's panel: the list, "Mark all as read", "Load more" and the settings link. */
export function NotificationsPanel({ data, onSelect, onClose }: NotificationsPanelProps) {
  const { status, items, unreadCount } = data;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold text-text">Notifications</h2>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<CheckCheck aria-hidden="true" className="size-3.5" />}
          disabled={unreadCount === 0 || status !== 'ready'}
          loading={data.markingAllRead}
          onClick={data.onMarkAllRead}
        >
          Mark all as read
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" aria-busy={status === 'loading'}>
        {status === 'loading' ? <LoadingRows /> : null}
        {status === 'error' ? (
          <div role="alert" className="flex flex-col items-center gap-3 px-6 py-8 text-center">
            <p className="text-sm font-semibold text-text">Could not load your notifications</p>
            <p className="text-xs text-text-muted">Check your connection and try again.</p>
            <Button onClick={data.onRetry}>Try again</Button>
          </div>
        ) : null}
        {status === 'ready' && items.length === 0 ? (
          <EmptyState
            icon={<Bell className="size-5" />}
            title="You're all caught up"
            description="Timesheet approvals, overdue invoices and other alerts will appear here."
            className="py-8"
          />
        ) : null}
        {status === 'ready' && items.length > 0 ? (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <NotificationRow key={item.id} item={item} onSelect={onSelect} />
            ))}
          </ul>
        ) : null}
        {status === 'ready' && data.hasMore ? (
          <div className="flex justify-center border-t border-border p-2">
            <Button variant="ghost" size="sm" loading={data.loadingMore} onClick={data.onLoadMore}>
              Load more
            </Button>
          </div>
        ) : null}
      </div>

      {data.settingsTo ? (
        <div className="border-t border-border p-2">
          <Link
            to={data.settingsTo}
            onClick={onClose}
            className={cn(buttonClasses({ variant: 'ghost', size: 'sm', fullWidth: true }))}
          >
            <Settings aria-hidden="true" className="size-3.5" />
            Notification settings
          </Link>
        </div>
      ) : null}
    </div>
  );
}
