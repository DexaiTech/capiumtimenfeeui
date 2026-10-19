import { Navigate } from 'react-router';

import { useOrgPreferenceStore, useReturnPathStore } from '@/app/store';
import { FullScreenLoader } from '@/components/common/FullScreenLoader';
import { ErrorState } from '@/components/ui';
import { routes, safeNextPath } from '@/constants/routes';
import { useMyOrganizations } from '@/features/organizations';
import { useSystemInfo } from '@/features/system';
import { isApiError } from '@/services/api';

/**
 * `/app`, where a signed-in user lands. It opens the organization used last (when the
 * user still belongs to it), else the first one, else onboarding.
 */
export function AppRedirectPage() {
  const lastOrgSlug = useOrgPreferenceStore((state) => state.lastOrgSlug);
  // An interrupted flow of this tab (an invitation, via registration) comes first.
  const returnPath = safeNextPath(useReturnPathStore((state) => state.returnPath));
  const system = useSystemInfo();
  // A closed deployment has one organization, named by the system information.
  const singleSlug = system.organization?.slug;
  const organizations = useMyOrganizations({ enabled: !returnPath && system.ready && !singleSlug });

  if (returnPath) return <Navigate to={returnPath} replace />;
  if (singleSlug) return <Navigate to={routes.org.home(singleSlug)} replace />;

  if (organizations.data) {
    const list = organizations.data;
    const target = list.find((entry) => entry.organization.slug === lastOrgSlug) ?? list[0] ?? null;
    return (
      <Navigate
        to={target ? routes.org.home(target.organization.slug) : routes.onboarding}
        replace
      />
    );
  }
  if (organizations.isError) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg">
        <ErrorState
          title="Could not load your practices"
          error={isApiError(organizations.error) ? organizations.error : null}
          onRetry={() => void organizations.refetch()}
          retrying={organizations.isRefetching}
        />
      </main>
    );
  }
  return <FullScreenLoader label="Opening your practice" />;
}
