import { ArrowUpRight, CircleCheck, CircleDashed, CircleSlash } from 'lucide-react';
import { Link } from 'react-router';

import {
  Badge,
  Button,
  Card,
  Skeleton,
  useToast,
  ProgressBar,
  buttonClasses,
  type BadgeTone,
} from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';

import { useOnboarding, useSetOnboardingStep } from '../../api/adminHooks';
import type { OnboardingStep, StepState } from '../../adminTypes';
import { describeError } from '../../utils/errors';
import { LoadError } from '../LoadError';
import { RelativeTime } from '../RelativeTime';

const STATE: Record<StepState, { label: string; tone: BadgeTone; verb: string }> = {
  done: { label: 'Done', tone: 'success', verb: 'done' },
  skipped: { label: 'Skipped', tone: 'grey', verb: 'skipped' },
  todo: { label: 'To do', tone: 'warning', verb: 'to do' },
};

function StateIcon({ state }: { state: StepState }) {
  const Icon = state === 'done' ? CircleCheck : state === 'skipped' ? CircleSlash : CircleDashed;
  const tone =
    state === 'done' ? 'text-success' : state === 'skipped' ? 'text-text-subtle' : 'text-warning';
  return <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${tone}`} />;
}

/** Where the state of a step comes from: the data, or a person who decided. */
function Source({ step }: { step: OnboardingStep }) {
  if (step.source === 'auto') return <>Counted from your practice's data.</>;
  if (step.updated_at) {
    return (
      <>
        Marked {STATE[step.state].verb}
        {step.updated_by_name ? ` by ${step.updated_by_name}` : ''}{' '}
        <RelativeTime iso={step.updated_at} />.
      </>
    );
  }
  return <>Only a person can complete this step.</>;
}

interface StepRowProps {
  step: OnboardingStep;
  canManage: boolean;
  busy: boolean;
  onMark: (state: StepState) => void;
}

function StepRow({ step, canManage, busy, onMark }: StepRowProps) {
  const { organization } = useOrg();
  const decided = step.source === 'manual' && step.state !== 'todo' && step.updated_at !== null;
  const link = step.link.startsWith('/') ? step.link : `/${step.link}`;

  return (
    <li>
      <Card padding="md" className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <StateIcon state={step.state} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-text">{step.title}</h3>
            <Badge tone={STATE[step.state].tone} size="sm">
              {STATE[step.state].label}
            </Badge>
          </div>
          <p className="text-sm text-text-muted">{step.description}</p>
          {step.detail ? <p className="text-xs text-text">{step.detail}</p> : null}
          <p className="text-xs text-text-subtle">
            <Source step={step} />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Link
            to={`${routes.org.home(organization.slug)}${link}`}
            aria-label={`Open ${step.title}`}
            className={buttonClasses({ size: 'sm' })}
          >
            Open
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
          {canManage && step.state === 'todo' ? (
            <>
              <Button
                size="sm"
                variant="primary"
                disabled={busy}
                aria-label={`Mark as done: ${step.title}`}
                onClick={() => onMark('done')}
              >
                Mark as done
              </Button>
              <Button
                size="sm"
                disabled={busy}
                aria-label={`Skip: ${step.title}`}
                onClick={() => onMark('skipped')}
              >
                Skip
              </Button>
            </>
          ) : null}
          {canManage && decided ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              aria-label={`Undo: ${step.title}`}
              onClick={() => onMark('todo')}
            >
              Undo
            </Button>
          ) : null}
        </div>
      </Card>
    </li>
  );
}

function ChecklistSkeleton() {
  return (
    <div role="status" aria-label="Loading the checklist" className="flex flex-col gap-3">
      <Skeleton shape="rect" className="h-24 w-full" />
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} shape="rect" className="h-20 w-full" />
      ))}
    </div>
  );
}

/** The steps to set a practice up, with how far it has got and what each step found. */
export function ChecklistView() {
  const { can } = useOrg();
  const { toast } = useToast();
  const checklist = useOnboarding();
  const mark = useSetOnboardingStep();
  const canManage = can(P.onboardingManage);

  if (checklist.isPending) return <ChecklistSkeleton />;
  if (checklist.isError && !checklist.data) {
    return (
      <LoadError
        title="Could not load the checklist"
        error={checklist.error}
        onRetry={() => void checklist.refetch()}
        retrying={checklist.isRefetching}
      />
    );
  }
  const { steps, summary } = checklist.data ?? { steps: [], summary: null };
  if (!summary) return null;
  const finished = summary.done + summary.skipped;

  const onMark = (step: OnboardingStep, state: StepState) => {
    mark.mutate(
      { key: step.key, state },
      {
        onSuccess: () =>
          toast({
            tone: 'success',
            title:
              state === 'todo'
                ? `${step.title} is back on the list`
                : `${step.title} marked ${STATE[state].verb}`,
          }),
        onError: (error) =>
          toast({ tone: 'error', ...describeError(error, 'Could not update the step') }),
      },
    );
  };

  return (
    <>
      <Card padding="lg" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-text">
            {summary.complete
              ? 'Your practice is set up'
              : `${finished} of ${summary.total} steps finished`}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Badge tone="success" size="sm">
              {summary.done} done
            </Badge>
            <Badge tone="grey" size="sm">
              {summary.skipped} skipped
            </Badge>
            <Badge tone="warning" size="sm">
              {summary.todo} to do
            </Badge>
          </div>
        </div>
        <ProgressBar
          label="Set-up progress"
          hideLabel
          value={summary.percent}
          tone={summary.complete ? 'success' : 'primary'}
          valueText={`${summary.percent}% finished`}
        />
        <p className="text-sm text-text-muted">
          {summary.complete
            ? 'Every step is done or skipped.'
            : 'Work through the steps in order. A step is done when your practice data says so, or when you mark it.'}
        </p>
      </Card>

      <ol aria-label="Set-up steps" className="flex flex-col gap-3">
        {steps.map((step) => (
          <StepRow
            key={step.key}
            step={step}
            canManage={canManage}
            busy={mark.isPending && mark.variables?.key === step.key}
            onMark={(state) => onMark(step, state)}
          />
        ))}
      </ol>
      {canManage ? null : (
        <p className="text-sm text-text-muted">
          Marking steps needs permission to manage the onboarding checklist.
        </p>
      )}
    </>
  );
}
