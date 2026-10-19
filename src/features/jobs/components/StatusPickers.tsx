import { ChevronDown } from 'lucide-react';

import { OptionPicker, type PickerOption } from '@/components/ui';

import { JOB_STATUS_META, JOB_TRANSITIONS, TASK_STATUS_META } from '../constants';
import { TASK_STATUSES, type JobStatus, type TaskStatus } from '../types';
import { JobStatusBadge, TaskStatusBadge } from './StatusBadges';

export interface JobStatusPickerProps {
  status: JobStatus;
  /** Accessible name, for example "Change the status of J00001 Year-end". */
  label: string;
  /** False shows the status only: the person may not change it. */
  canChange: boolean;
  onChoose: (to: JobStatus) => void;
}

/** The status of a job; for someone who may change it, a button listing what it may move to. */
export function JobStatusPicker({ status, label, canChange, onChoose }: JobStatusPickerProps) {
  const transitions = JOB_TRANSITIONS[status];
  if (!canChange || transitions.length === 0) return <JobStatusBadge status={status} />;
  const options: PickerOption[] = transitions.map((transition) => ({
    value: transition.to,
    label: transition.label,
    description: `Becomes ${JOB_STATUS_META[transition.to].label}`,
  }));
  return (
    <OptionPicker
      label={label}
      options={options}
      value={[]}
      onChange={([to]) => {
        if (to) onChoose(to as JobStatus);
      }}
      triggerClassName="px-1 py-0.5"
    >
      <JobStatusBadge status={status} />
      <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
    </OptionPicker>
  );
}

export interface TaskStatusPickerProps {
  status: TaskStatus;
  label: string;
  canChange: boolean;
  onChoose: (to: TaskStatus) => void;
}

/** The status of a task; any other status may be chosen. */
export function TaskStatusPicker({ status, label, canChange, onChoose }: TaskStatusPickerProps) {
  if (!canChange) return <TaskStatusBadge status={status} />;
  const options: PickerOption[] = TASK_STATUSES.filter((entry) => entry !== status).map(
    (entry) => ({ value: entry, label: TASK_STATUS_META[entry].label }),
  );
  return (
    <OptionPicker
      label={label}
      options={options}
      value={[]}
      onChange={([to]) => {
        if (to) onChoose(to as TaskStatus);
      }}
      triggerClassName="px-1 py-0.5"
    >
      <TaskStatusBadge status={status} />
      <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
    </OptionPicker>
  );
}
