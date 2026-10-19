import { Badge, ProgressBar } from '@/components/ui';
import { formatBasisPoints } from '@/utils/money';

import { JOB_STATUS_META, RAG_META, TASK_STATUS_META } from '../constants';
import type { JobStatus, Rag, TaskStatus } from '../types';
import { usagePercent, usageTone } from '../utils/format';

/** The status of a job as a pill: the word, with the colour as a second cue. */
export function JobStatusBadge({ status }: { status: JobStatus }) {
  const meta = JOB_STATUS_META[status];
  return (
    <Badge tone={meta.tone} size="sm" dot>
      {meta.label}
    </Badge>
  );
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const meta = TASK_STATUS_META[status];
  return (
    <Badge tone={meta.tone} size="sm" dot>
      {meta.label}
    </Badge>
  );
}

export function RagBadge({ rag }: { rag: Rag }) {
  const meta = RAG_META[rag];
  return (
    <Badge tone={meta.tone} size="sm">
      {meta.label}
    </Badge>
  );
}

export interface UsageBarProps {
  /** What is measured, for the bar's accessible name ("Hours budget of J00001"). */
  label: string;
  usageBp: number | null;
  className?: string;
}

/** A budget usage bar with its percentage; "No budget" when there is nothing to compare with. */
export function UsageBar({ label, usageBp, className }: UsageBarProps) {
  if (usageBp === null) return <span className="text-xs text-text-muted">No budget</span>;
  return (
    <div className="flex min-w-28 items-center gap-2">
      <ProgressBar
        className={className ?? 'flex-1'}
        label={label}
        hideLabel
        value={usagePercent(usageBp)}
        tone={usageTone(usageBp)}
        valueText={formatBasisPoints(usageBp)}
      />
      <span className="w-12 text-right text-xs text-text tabular-nums">
        {formatBasisPoints(usageBp)}
      </span>
    </div>
  );
}
