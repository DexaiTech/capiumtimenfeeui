import { formatRelativeTime } from '@/utils/format';

export interface RelativeTimeProps {
  iso: string;
  className?: string;
}

function formatAbsolute(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/** Relative inline ("3 minutes ago"); the absolute time on hover and in the `<time>` element. */
export function RelativeTime({ iso, className }: RelativeTimeProps) {
  const absolute = formatAbsolute(iso);
  return (
    <time dateTime={iso} title={absolute} className={className}>
      {formatRelativeTime(iso) || absolute}
    </time>
  );
}
