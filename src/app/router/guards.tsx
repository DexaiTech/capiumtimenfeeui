import { ShieldOff } from 'lucide-react';
import { Link, Navigate, Outlet } from 'react-router';

import { PageHeader } from '@/components/layout';
import { buttonClasses, Card, EmptyState } from '@/components/ui';
import { allows, visibleModules, type AccessRule, type ModuleId } from '@/constants/navigation';
import { PERMISSIONS } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';

import { describePermission } from './describePermission';

/**
 * The calm page shown for a route whose permission the caller's role does not include. With the
 * rule of the page it says what the page needs, so the person can ask for exactly that.
 */
export function NoAccessPage({ rule }: { rule?: AccessRule }) {
  const { organization, can } = useOrg();
  useDocumentTitle('No access');
  const needs = rule?.anyOf.map(describePermission) ?? [];
  return (
    <>
      <PageHeader title="No access" />
      <Card padding="none">
        <EmptyState
          size="page"
          icon={<ShieldOff className="size-7" />}
          title="Your role does not include this page"
          description={
            needs.length > 0
              ? `This page needs permission to: ${needs.join(' or ')}. Ask your practice administrator to add it to your role.`
              : 'Ask your practice administrator if you need it.'
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                to={routes.org.dashboard(organization.slug)}
                className={buttonClasses({ variant: 'primary' })}
              >
                Go to the dashboard
              </Link>
              {can(PERMISSIONS.ticketCreate) ? (
                <Link
                  to={`${routes.org.tickets(organization.slug)}?new=1`}
                  className={buttonClasses({ variant: 'secondary' })}
                >
                  Report a problem
                </Link>
              ) : null}
            </div>
          }
        />
      </Card>
    </>
  );
}

/**
 * Renders the child routes when the caller's practice permissions satisfy `rule` (the same
 * rule that shows the page in the navigation), else the no-access page. UI gating only.
 */
export function RequireAccess({ rule }: { rule: AccessRule }) {
  const { can } = useOrg();
  return allows(rule, can) ? <Outlet /> : <NoAccessPage rule={rule} />;
}

/** The index of a module with sub-pages: the first sub-page the caller may open. */
export function ModuleIndexRedirect({ moduleId }: { moduleId: ModuleId }) {
  const { organization, can } = useOrg();
  const module = visibleModules(organization.slug, can).find((entry) => entry.id === moduleId);
  if (!module) return <NoAccessPage />;
  return <Navigate to={module.href} replace />;
}
