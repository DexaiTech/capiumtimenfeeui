import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/constants/queryKeys';
import { useOrg, type OrganizationContext } from '@/features/organizations';
import { api } from '@/services/api';
import type { Organization, WipValuationPreview, WipValuationSource } from '@/types/organization';

const path = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/wip-valuation`;

export interface SaveWipValuation {
  sources: WipValuationSource[];
  /** Re-value the unbilled time at the new order in the same save. */
  revalue: boolean;
}

/** What saving an order would change; nothing is saved (APT84). */
export function useWipValuationPreview() {
  const { organization } = useOrg();
  return useMutation({
    mutationFn: (sources: WipValuationSource[]) =>
      api.post<WipValuationPreview>(`${path(organization.id)}/preview`, { sources }),
  });
}

/**
 * Saves the WIP valuation order and, with `revalue`, re-values the unbilled time. The practice
 * context takes the saved practice at once; a re-value moves the time, WIP, job, client, report
 * and dashboard figures, so those are refreshed too, as after a re-rate.
 */
export function useSaveWipValuation() {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveWipValuation) => api.put<Organization>(path(organization.id), body),
    onSuccess: (saved) => {
      const merge = (context: OrganizationContext): OrganizationContext =>
        context.organization.id === saved.id ? { ...context, organization: saved } : context;
      queryClient.setQueryData<OrganizationContext>(
        queryKeys.organizationBySlug(saved.slug),
        (context) => (context ? merge(context) : context),
      );
      queryClient.setQueryData<OrganizationContext[]>(queryKeys.myOrganizations(), (list) =>
        list?.map(merge),
      );
      const id = saved.id;
      for (const queryKey of [
        queryKeys.org.detail(id),
        queryKeys.org.time(id),
        queryKeys.org.timesheets(id),
        queryKeys.org.wip(id),
        queryKeys.org.jobs(id),
        queryKeys.org.clients(id),
        queryKeys.org.reports(id),
        queryKeys.org.dashboard(id),
        queryKeys.org.rateRules(id),
        queryKeys.org.rateReruns(id),
        queryKeys.org.auditLogs(id),
      ]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}
