import { useEffect, useMemo, useState } from 'react';
import { Outlet, useMatch, useParams } from 'react-router';

import { useOrgPreferenceStore } from '@/app/store';
import { AppShell, PublicLayout } from '@/components/layout';
import { IdleWarningDialog } from '@/components/layout/IdleWarningDialog';
import { ErrorState, useToast } from '@/components/ui';
import { RESERVED_TOP_LEVEL } from '@/constants/routes';
import { useAuth } from '@/features/auth';
import { useNotificationsShell } from '@/features/notifications';
import { OrgProvider, useMyOrganizations, useOrganizationBySlug } from '@/features/organizations';
import { useRoleName, useSystemInfo } from '@/features/system';
import { useIdleTimeout } from '@/hooks';
import { OrgContentSkeleton } from '@/pages/app/OrgContentSkeleton';
import { OrgNotFoundPage } from '@/pages/app/OrgNotFoundPage';
import { isApiError } from '@/services/api';

import { buildShellData } from './shellData';

/**
 * Wiring between the session, the current practice and the layouts. The layouts themselves
 * stay free of feature imports: they receive data and callbacks as props.
 */

const isNotFound = (error: unknown) => isApiError(error) && error.status === 404;

export function AppShellRoute() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const roleName = useRoleName();
  const [loggingOut, setLoggingOut] = useState(false);
  // A parent route does not see its children's params, so match the URL instead.
  const matched = useMatch('/:orgSlug/*')?.params.orgSlug;
  const orgSlug =
    matched && !(RESERVED_TOP_LEVEL as ReadonlyArray<string>).includes(matched)
      ? matched
      : undefined;
  const organizations = useMyOrganizations();
  const current = useOrganizationBySlug(orgSlug);
  const system = useSystemInfo();

  const missing = isNotFound(current.error);
  const context = orgSlug && !missing ? (current.data ?? null) : null;
  const list = organizations.data;
  // The bell: the count is polled and the list fetched while the panel is open.
  const notifications = useNotificationsShell({
    organizationId: context?.organization.id ?? null,
    slug: context?.organization.slug ?? null,
  });

  // Signed out after 30 idle minutes; a warning comes at 25.
  const idle = useIdleTimeout({
    enabled: Boolean(user) && !loggingOut,
    onTimeout: () => {
      setLoggingOut(true);
      void logout().then(() =>
        toast({
          tone: 'info',
          title: 'You were signed out',
          description: 'You were inactive for 30 minutes. Sign in again to continue.',
        }),
      );
    },
  });

  const shell = useMemo(
    () =>
      buildShellData({
        context,
        organizations: list ?? [],
        roleName,
        canSwitchPractice: system.ready && !system.closed && (list?.length ?? 0) > 0,
        canCreatePractice: system.openRegistration,
        notifications,
      }),
    [context, list, roleName, system.ready, system.closed, system.openRegistration, notifications],
  );

  if (!user) return null; // RequireAuth guarantees a user; this only narrows the type.

  const onLogout = () => {
    if (loggingOut) return;
    setLoggingOut(true);
    void logout().then(() => toast({ tone: 'info', title: 'You have been logged out' }));
  };

  return (
    <>
      <AppShell user={user} onLogout={onLogout} shell={shell} />
      <IdleWarningDialog
        open={idle.warning}
        secondsLeft={idle.secondsLeft}
        onStay={idle.stay}
        onSignOut={onLogout}
      />
    </>
  );
}

/**
 * The practice layer of `/:orgSlug/...`: resolves the slug once through
 * `GET /organizations/by-slug/{slug}`, provides the practice context (practice, role and
 * permissions) to everything below, and remembers the practice for `/app`.
 */
export function OrgRoute() {
  const { orgSlug } = useParams();
  const query = useOrganizationBySlug(orgSlug);
  const lastOrgSlug = useOrgPreferenceStore((state) => state.lastOrgSlug);
  const setLastOrgSlug = useOrgPreferenceStore((state) => state.setLastOrgSlug);
  const missing = isNotFound(query.error);
  const resolvedSlug = missing ? undefined : query.data?.organization.slug;

  useEffect(() => {
    if (resolvedSlug) setLastOrgSlug(resolvedSlug);
    // A remembered practice that is gone (deleted, or the membership ended) is forgotten.
    else if (missing && orgSlug && orgSlug === lastOrgSlug) setLastOrgSlug(null);
  }, [resolvedSlug, missing, orgSlug, lastOrgSlug, setLastOrgSlug]);

  if (missing) return <OrgNotFoundPage />;
  if (query.data) {
    return (
      <OrgProvider value={query.data}>
        <Outlet />
      </OrgProvider>
    );
  }
  if (query.isError) {
    return (
      <ErrorState
        title="Could not load this practice"
        error={isApiError(query.error) ? query.error : null}
        onRetry={() => void query.refetch()}
        retrying={query.isRefetching}
      />
    );
  }
  return <OrgContentSkeleton />;
}

export function PublicLayoutRoute() {
  return <PublicLayout />;
}
