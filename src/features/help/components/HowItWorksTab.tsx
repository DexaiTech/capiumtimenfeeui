import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';

import { Card } from '@/components/ui';

import { BEFORE_YOU_START, LIFECYCLES, ROLES } from '../flowData';
import { FlowDiagram } from './FlowDiagram';

/** The flow chart, then the states records go through, who can do what and what to do first. */
export function HowItWorksTab() {
  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-3xl text-sm text-text-muted">
        This is the whole product on one page. Follow the numbers from the top; each step opens the
        page where it is done.
      </p>
      <FlowDiagram />

      <Card padding="lg" role="region" aria-label="Before you start">
        <h3 className="mb-3 text-base font-semibold text-text">Before you start</h3>
        <ul className="flex flex-col gap-3">
          {BEFORE_YOU_START.map((item) => (
            <li key={item.title} className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-text">{item.title}</span>
              <span className="text-sm text-text-muted">{item.why}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card padding="lg" role="region" aria-label="Statuses">
        <h3 className="mb-3 text-base font-semibold text-text">Statuses</h3>
        <dl className="flex flex-col gap-4">
          {LIFECYCLES.map((lifecycle) => (
            <div key={lifecycle.name} className="flex flex-col gap-1">
              <dt className="text-sm font-semibold text-text">{lifecycle.name}</dt>
              <dd className="flex flex-col gap-1">
                <span className="flex flex-wrap items-center gap-1 text-xs">
                  {lifecycle.steps.map((step, index) => (
                    <Fragment key={step}>
                      {index > 0 ? (
                        <ChevronRight aria-hidden="true" className="size-3.5 text-text-subtle" />
                      ) : null}
                      <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-text">
                        {step}
                      </span>
                    </Fragment>
                  ))}
                </span>
                <span className="text-xs text-text-muted">{lifecycle.note}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card padding="lg" role="region" aria-label="Who can do what">
        <h3 className="mb-3 text-base font-semibold text-text">Who can do what</h3>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[8rem_1fr]">
          {ROLES.map((row) => (
            <Fragment key={row.role}>
              <dt className="text-sm font-semibold text-text">{row.role}</dt>
              <dd className="text-sm text-text-muted">{row.can}</dd>
            </Fragment>
          ))}
        </dl>
        <p className="mt-3 text-xs text-text-muted">
          Your practice can change what each role may do under Settings › Roles &amp; Permissions.
        </p>
      </Card>
    </div>
  );
}
