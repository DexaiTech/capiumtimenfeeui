import type { AuditLogEntry } from '../../types';
import { formatMetadataValue, humanizeKey } from '../../utils/audit';
import { formatDateTime } from '../../utils/datetime';

interface Pair {
  label: string;
  value: string;
  mono?: boolean;
}

/**
 * The details of one entry: `metadata` as plain-text key/value pairs, never as markup, next to the
 * request it came from. `stacked` puts the two blocks one below the other (in the drawer).
 */
export function AuditDetails({
  entry,
  stacked = false,
}: {
  entry: AuditLogEntry;
  stacked?: boolean;
}) {
  const context: Pair[] = [
    { label: 'Time', value: formatDateTime(entry.created_at) },
    { label: 'Action', value: entry.action, mono: true },
    ...(entry.target_type
      ? [
          {
            label: 'Target',
            value: [entry.target_type, entry.target_id].filter(Boolean).join(' · '),
            mono: true,
          },
        ]
      : []),
    { label: 'IP address', value: entry.ip_address ?? '—', mono: true },
    { label: 'Device', value: entry.user_agent ?? '—' },
  ];
  const metadata: Pair[] = Object.entries(entry.metadata ?? {}).map(([key, value]) => ({
    label: humanizeKey(key),
    value: formatMetadataValue(value),
  }));

  const list = (pairs: Pair[]) => (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
      {pairs.map((pair) => (
        <div key={pair.label} className="contents">
          <dt className="text-xs font-medium text-text-muted sm:pt-0.5">{pair.label}</dt>
          <dd
            className={
              pair.mono
                ? 'mb-1.5 font-mono text-xs break-all text-text sm:mb-0'
                : 'mb-1.5 text-sm break-words text-text sm:mb-0'
            }
          >
            {pair.value}
          </dd>
        </div>
      ))}
    </dl>
  );

  return (
    <div className={stacked ? 'grid gap-5' : 'grid gap-5 lg:grid-cols-2'}>
      <div className="flex flex-col gap-2.5">
        <h4 className="text-xs font-semibold tracking-wide text-text-subtle uppercase">Details</h4>
        {metadata.length > 0 ? (
          list(metadata)
        ) : (
          <p className="text-sm text-text-muted">No further details were recorded.</p>
        )}
      </div>
      <div className="flex flex-col gap-2.5">
        <h4 className="text-xs font-semibold tracking-wide text-text-subtle uppercase">Request</h4>
        {list(context)}
      </div>
    </div>
  );
}
