import { ArrowRight, CircleDashed, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { Button, buttonClasses, Card, ProgressBar } from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { modulePath, ORG_SEGMENTS, routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { useOnboarding } from '@/features/settings';

const NEXT_STEPS = 3;

const hiddenKey = (organizationId: string) => `tf:getting-started:hidden:${organizationId}`;

function wasHidden(organizationId: string): boolean {
  try {
    return window.localStorage.getItem(hiddenKey(organizationId)) === '1';
  } catch {
    return false;
  }
}

/**
 * The first thing a new practice sees: how far the set-up has got and the next few steps, each
 * one click away. It goes away when every step is done or skipped, or when a person hides it.
 * Read from the onboarding checklist, so it never disagrees with Settings.
 */
export function GettingStartedCard() {
  const { organization, can } = useOrg();
  const checklist = useOnboarding();
  const [hidden, setHidden] = useState(() => wasHidden(organization.id));
  const canManage = can(P.onboardingManage);

  const data = checklist.data;
  if (hidden || !data || data.summary.complete) return null;

  const { summary, steps } = data;
  const finished = summary.done + summary.skipped;
  const next = steps.filter((step) => step.state === 'todo').slice(0, NEXT_STEPS);
  const slug = organization.slug;

  const hide = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(hiddenKey(organization.id), '1');
    } catch {
      // The card then comes back at the next visit: nothing is lost.
    }
  };

  return (
    <Card
      padding="lg"
      role="region"
      aria-label="Getting started"
      className="flex flex-col gap-4 border-brand/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-text">Getting started</h2>
          <p className="max-w-2xl text-sm text-text-muted">
            {canManage
              ? 'A few steps and the practice is ready to record time and send invoices. Do them in this order.'
              : 'Your administrator is setting the practice up. Until then, some pages may be empty.'}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Hide getting started" onClick={hide}>
          <X aria-hidden="true" className="size-5" />
        </Button>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium text-text">
          {finished} of {summary.total} steps finished
        </p>
        <ProgressBar
          label="Set-up progress"
          hideLabel
          value={summary.percent}
          valueText={`${summary.percent}% finished`}
        />
      </div>
      {canManage ? (
        <ol className="flex flex-col gap-2">
          {next.map((step, index) => (
            <li
              key={step.key}
              className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <CircleDashed aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold text-text">
                    {index === 0 ? 'Next: ' : ''}
                    {step.title}
                  </span>
                  <span className="text-xs text-text-muted">{step.description}</span>
                </div>
              </div>
              <Link
                to={`${routes.org.home(slug)}${step.link.startsWith('/') ? step.link : `/${step.link}`}`}
                aria-label={`Open ${step.title}`}
                className={buttonClasses({
                  size: 'sm',
                  variant: index === 0 ? 'primary' : 'secondary',
                })}
              >
                Open
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {canManage ? (
          <Link
            to={modulePath(slug, ORG_SEGMENTS.settings, 'onboarding')}
            className="font-medium text-brand-text hover:underline"
          >
            See all {summary.total} steps
          </Link>
        ) : null}
        <Link to={routes.org.help(slug)} className="font-medium text-brand-text hover:underline">
          How it works
        </Link>
      </div>
    </Card>
  );
}
