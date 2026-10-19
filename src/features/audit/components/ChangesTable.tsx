import { useOrg } from '@/features/organizations';
import { cn } from '@/utils/cn';

import type { AuditChange } from '../types';
import { formatChangeValue, humanizeField } from '../utils/format';

function Value({ text, before = false }: { text: string | null; before?: boolean }) {
  if (text === null) return <span className="text-text-subtle">None</span>;
  return (
    <span
      className={cn(
        'break-words',
        // The before column is struck through as well as muted: not colour alone.
        before ? 'text-text-muted line-through' : 'font-medium text-text',
      )}
    >
      {text}
    </span>
  );
}

export interface ChangesTableProps {
  changes: ReadonlyArray<AuditChange>;
  /** The accessible caption, for example "Changes made on 05/10/2026 10:14". */
  caption: string;
  className?: string;
}

/** The fields an action changed, one row each: the field, what it was, what it became. */
export function ChangesTable({ changes, caption, className }: ChangesTableProps) {
  const { organization } = useOrg();
  const zone = organization.timezone;
  return (
    <table className={cn('w-full text-xs', className)}>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="text-left text-text-muted">
          <th scope="col" className="pr-3 pb-1 font-medium">
            Field
          </th>
          <th scope="col" className="pr-3 pb-1 font-medium">
            Before
          </th>
          <th scope="col" className="pb-1 font-medium">
            After
          </th>
        </tr>
      </thead>
      <tbody>
        {changes.map((change) => (
          <tr key={change.field} className="border-t border-row-border align-top">
            <th scope="row" className="py-1 pr-3 text-left font-medium text-text">
              {humanizeField(change.field)}
            </th>
            <td className="py-1 pr-3">
              <Value before text={formatChangeValue(change.before, zone)} />
            </td>
            <td className="py-1">
              <Value text={formatChangeValue(change.after, zone)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
