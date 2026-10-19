import { ArrowDown, ArrowUp, Gauge } from 'lucide-react';

import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  InitialsAvatar,
  ProgressBar,
  Skeleton,
} from '@/components/ui';
import { formatMinutes } from '@/utils/minutes';
import { formatBasisPoints } from '@/utils/money';

import type { Utilisation, UtilisationRow } from '../../types';
import { LoadError } from '../PageShell';

export interface UtilisationCardProps {
  data: Utilisation | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  retrying: boolean;
}

/** Chargeable time over capacity, as a share, with a sign and an arrow so the colour is not alone. */
function Variance({ bp }: { bp: number | null }) {
  if (bp === null) return <span>—</span>;
  const sign = bp > 0 ? '+' : '';
  return (
    <span className={bp < 0 ? 'text-warning' : bp > 0 ? 'text-success' : undefined}>
      <span className="inline-flex items-center gap-0.5">
        {bp < 0 ? <ArrowDown className="size-3" aria-hidden="true" /> : null}
        {bp > 0 ? <ArrowUp className="size-3" aria-hidden="true" /> : null}
        {sign}
        {formatBasisPoints(bp)}
      </span>
      <span className="sr-only">
        {bp < 0 ? ' below target' : bp > 0 ? ' above target' : ' on target'}
      </span>
    </span>
  );
}

function Row({ row }: { row: UtilisationRow }) {
  const utilisation = row.utilisation_bp;
  const tone =
    utilisation === null || row.target_bp === null
      ? 'primary'
      : utilisation >= row.target_bp
        ? 'success'
        : 'warning';
  return (
    <tr className="border-t border-row-border align-middle">
      <th scope="row" className="py-2 pr-3 pl-4 text-left font-normal">
        <span className="flex items-center gap-2">
          <InitialsAvatar
            name={row.full_name}
            initials={row.initials}
            colorKey={row.user_id}
            size="xs"
          />
          <span className="font-semibold text-text uppercase">{row.full_name}</span>
          {row.status !== 'active' ? (
            <Badge tone="grey" size="sm">
              {row.status}
            </Badge>
          ) : null}
        </span>
      </th>
      <td className="px-3 py-2 text-right tabular-nums">{formatMinutes(row.capacity_minutes)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatMinutes(row.total_minutes)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatMinutes(row.chargeable_minutes)}</td>
      <td className="min-w-40 px-3 py-2">
        <ProgressBar
          label={`Utilisation of ${row.full_name}`}
          hideLabel
          value={utilisation ?? 0}
          max={10000}
          tone={tone}
          valueText={formatBasisPoints(utilisation)}
        />
        <span className="mt-0.5 block text-right font-medium text-text tabular-nums">
          {formatBasisPoints(utilisation)}
        </span>
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{formatBasisPoints(row.target_bp)}</td>
      <td className="py-2 pr-4 pl-3 text-right tabular-nums">
        <Variance bp={row.variance_bp} />
      </td>
    </tr>
  );
}

/** Utilisation per person: chargeable time against capacity and against their target. */
export function UtilisationCard({ data, loading, error, onRetry, retrying }: UtilisationCardProps) {
  return (
    <Card padding="none" aria-label="Utilisation" role="region">
      <CardHeader
        title="Utilisation"
        description="Chargeable time as a share of each person's capacity in the dates chosen."
      />
      {error && !data ? (
        <LoadError
          title="Could not load the utilisation"
          error={error}
          onRetry={onRetry}
          retrying={retrying}
        />
      ) : loading || !data ? (
        <div className="p-4" aria-busy="true">
          <Skeleton lines={4} />
        </div>
      ) : data.rows.length === 0 ? (
        <EmptyState
          icon={<Gauge className="size-6" />}
          title="No utilisation to show"
          description="Nobody has capacity or recorded time in these dates."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-xs">
            <caption className="sr-only">Utilisation per person</caption>
            <thead>
              <tr className="text-left text-text-muted">
                <th scope="col" className="h-[37px] pr-3 pl-4 font-medium">
                  Person
                </th>
                <th scope="col" className="px-3 text-right font-medium">
                  Capacity
                </th>
                <th scope="col" className="px-3 text-right font-medium">
                  Logged
                </th>
                <th scope="col" className="px-3 text-right font-medium">
                  Chargeable
                </th>
                <th scope="col" className="px-3 font-medium">
                  Utilisation
                </th>
                <th scope="col" className="px-3 text-right font-medium">
                  Target
                </th>
                <th scope="col" className="pr-4 pl-3 text-right font-medium">
                  Against target
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <Row key={row.user_id} row={row} />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-surface-sunken font-semibold text-text">
                <th scope="row" className="py-2 pr-3 pl-4 text-left">
                  Total, {data.totals.working_days} working{' '}
                  {data.totals.working_days === 1 ? 'day' : 'days'}
                </th>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatMinutes(data.totals.capacity_minutes)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatMinutes(data.totals.total_minutes)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatMinutes(data.totals.chargeable_minutes)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatBasisPoints(data.totals.utilisation_bp)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatBasisPoints(data.totals.target_bp)}
                </td>
                <td className="py-2 pr-4 pl-3 text-right tabular-nums">
                  <Variance bp={data.totals.variance_bp} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}
