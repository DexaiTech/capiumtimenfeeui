import { Badge, Table, type TableColumn } from '@/components/ui';

import type { LadderStep } from '../../types';
import { formatRate } from '../../utils/format';
import { stepDetail, stepState } from '../../utils/ladder';

export interface RateLadderProps {
  /** Names the table, for example "Charge-out rate levels". */
  caption: string;
  steps: ReadonlyArray<LadderStep>;
  /** Shows the position of each level (the charge-out ladder); a cost step has none. */
  numbered?: boolean;
}

/**
 * The levels a rate is chosen from, most specific first, each with whether it exists for the
 * question and whether it won. A level that exists but did not win says it was overridden.
 */
export function RateLadder({ caption, steps, numbered = false }: RateLadderProps) {
  const columns: TableColumn<LadderStep>[] = [
    ...(numbered
      ? [
          {
            id: 'level',
            header: 'Level',
            className: 'w-16',
            card: 'hidden' as const,
            cell: (step: LadderStep) => (
              <span className="text-text-muted tabular-nums">{step.level ?? '—'}</span>
            ),
          },
        ]
      : []),
    {
      id: 'label',
      header: 'Rate',
      card: 'title',
      cell: (step) => <span className="font-medium text-text">{step.label}</span>,
    },
    {
      id: 'status',
      header: 'Result',
      className: 'w-40',
      cell: (step) => {
        const state = stepState(step);
        return (
          <Badge tone={state.tone} size="sm">
            {state.label}
          </Badge>
        );
      },
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'end',
      className: 'w-32 whitespace-nowrap',
      cell: (step) => (
        <span className="text-text tabular-nums">{step.exists ? formatRate(step.rate) : '—'}</span>
      ),
    },
    {
      id: 'detail',
      header: 'Where it comes from',
      cell: (step) => {
        const detail = stepDetail(step);
        return detail ? (
          <span className="text-sm text-text-muted">{detail}</span>
        ) : (
          <span className="text-text-muted">—</span>
        );
      },
    },
  ];

  return (
    <Table
      caption={caption}
      columns={columns}
      rows={steps}
      rowKey={(step) => `${step.level ?? 'none'}-${step.source}`}
    />
  );
}
