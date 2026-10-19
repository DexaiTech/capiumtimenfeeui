import { formatRelativeTime } from '@/utils/format';

import { formatDateTime } from '../utils/datetime';

export interface RelativeTimeProps {
  iso: string;
  className?: string;
}

/** Relative inline ("3 minutes ago"), absolute on hover and for assistive technology via `<time>`. */
export function RelativeTime({ iso, className }: RelativeTimeProps) {
  const absolute = formatDateTime(iso);
  return (
    <time dateTime={iso} title={absolute} className={className}>
      {formatRelativeTime(iso) || absolute}
    </time>
  );
}
