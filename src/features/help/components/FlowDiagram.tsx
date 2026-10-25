import { ArrowDown } from 'lucide-react';
import { Link } from 'react-router';

import { Card } from '@/components/ui';
import { findModule } from '@/constants/navigation';
import { useOrg } from '@/features/organizations';

import { FLOW_PHASES, SIDE_ROUTES, type FlowStep, type FlowTarget } from '../flowData';
import { pageHref } from '../pageHref';

function labelOf(target: FlowTarget): string {
  const module = findModule(target.module);
  const page = module.pages.find((entry) => entry.id === target.page);
  return page ? `${module.label} › ${page.label}` : module.label;
}

function Step({ step, number, last }: { step: FlowStep; number: number; last: boolean }) {
  const { organization } = useOrg();
  return (
    <li className="flex gap-4">
      <div className="flex flex-col items-center">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white"
        >
          {number}
        </span>
        {last ? null : (
          <>
            <span aria-hidden="true" className="w-px flex-1 bg-border" />
            <ArrowDown aria-hidden="true" className="size-4 shrink-0 text-text-subtle" />
          </>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 pb-5">
        <Link
          to={pageHref(organization.slug, step.where)}
          className="w-fit text-sm font-semibold text-brand-text hover:underline"
        >
          {step.title}
        </Link>
        <p className="text-sm text-text">{step.what}</p>
        <p className="text-xs text-text-muted">Where: {labelOf(step.where)}</p>
        {step.needs ? (
          <p className="w-fit rounded-md bg-surface-sunken px-2 py-1 text-xs text-text">
            <strong className="font-semibold">Before this:</strong> {step.needs}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The project as one flow: set up once, do the work, bill and get paid. Every step opens the page
 * it names. Side routes (estimates, recurring invoices, corrections) are listed under it.
 */
export function FlowDiagram() {
  const { organization } = useOrg();
  // The number of the first step of each phase, so the steps count on from one phase to the next.
  const firstOf = FLOW_PHASES.map((_, index) =>
    FLOW_PHASES.slice(0, index).reduce((total, phase) => total + phase.steps.length, 0),
  );
  return (
    <div className="flex flex-col gap-5">
      {FLOW_PHASES.map((phase, phaseIndex) => (
        <Card key={phase.id} padding="lg" role="region" aria-label={phase.title}>
          <div className="mb-4 flex flex-col gap-0.5">
            <h3 className="text-base font-semibold text-text">{phase.title}</h3>
            <p className="text-xs text-text-muted">{phase.hint}</p>
          </div>
          <ol className="flex flex-col">
            {phase.steps.map((step, index) => (
              <Step
                key={step.id}
                step={step}
                number={(firstOf[phaseIndex] ?? 0) + index + 1}
                last={index === phase.steps.length - 1}
              />
            ))}
          </ol>
        </Card>
      ))}
      <Card padding="lg" role="region" aria-label="Other routes">
        <h3 className="mb-3 text-base font-semibold text-text">Other routes</h3>
        <ul className="grid gap-3 sm:grid-cols-2">
          {SIDE_ROUTES.map((route) => (
            <li key={route.title} className="flex flex-col gap-0.5">
              <Link
                to={pageHref(organization.slug, route.where)}
                className="w-fit text-sm font-semibold text-brand-text hover:underline"
              >
                {route.title}
              </Link>
              <span className="text-sm text-text">{route.what}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
