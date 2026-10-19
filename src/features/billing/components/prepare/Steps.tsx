import { cn } from '@/utils/cn';

export type PrepareStep = 'work' | 'review' | 'details';

const STEPS: ReadonlyArray<{ id: PrepareStep; label: string }> = [
  { id: 'work', label: 'Choose the work' },
  { id: 'review', label: 'Review the lines' },
  { id: 'details', label: 'Dates and notes' },
];

/** Where the person is in preparing the invoice: the step on show is marked for screen readers too. */
export function Steps({ current }: { current: PrepareStep }) {
  const at = STEPS.findIndex((step) => step.id === current);
  return (
    <ol aria-label="Steps" className="flex flex-wrap gap-x-6 gap-y-2">
      {STEPS.map((step, index) => (
        <li
          key={step.id}
          aria-current={index === at ? 'step' : undefined}
          className={cn(
            'flex items-center gap-2 text-sm',
            index === at ? 'font-semibold text-text' : 'text-text-muted',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'grid size-6 place-items-center rounded-full border text-xs',
              index === at
                ? 'border-primary bg-primary text-white'
                : index < at
                  ? 'border-primary text-primary'
                  : 'border-border',
            )}
          >
            {index + 1}
          </span>
          {step.label}
        </li>
      ))}
    </ol>
  );
}
