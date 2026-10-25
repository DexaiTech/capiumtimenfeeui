import { Link } from 'react-router';

import { buttonClasses, Card } from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';

/** Where to take a problem or a question. */
export function SupportTab() {
  const { organization, can } = useOrg();
  const slug = organization.slug;
  return (
    <Card padding="lg" role="region" aria-label="Get help" className="flex flex-col gap-4">
      <p className="max-w-2xl text-sm text-text-muted">
        Something not working, or unclear? Report it as a ticket in Application Testing: say what
        you tried, what you expected and what happened, and add a screenshot. Every change to the
        ticket is kept in its timeline.
      </p>
      <div className="flex flex-wrap gap-2">
        {can(PERMISSIONS.ticketCreate) ? (
          <Link
            to={`${routes.org.tickets(slug)}?new=1`}
            className={buttonClasses({ variant: 'primary' })}
          >
            Report a problem
          </Link>
        ) : null}
        {can(PERMISSIONS.ticketRead) ? (
          <Link to={routes.org.tickets(slug)} className={buttonClasses({ variant: 'secondary' })}>
            See your tickets
          </Link>
        ) : null}
      </div>
      <p className="text-xs text-text-muted">
        For access to a page or a feature, ask your practice administrator: they decide what each
        role can see.
      </p>
    </Card>
  );
}
