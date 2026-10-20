import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/constants/queryKeys';
import type { Organization, OrganizationContext, OrganizationUpdate } from '@/types/organization';

import { organizationsApi, type CreateOrganizationBody } from './organizationsApi';

const byName = (a: OrganizationContext, b: OrganizationContext) =>
  a.organization.name.localeCompare(b.organization.name);

/** Writes a context the API just returned into both caches, so the next screen renders without a fetch. */
function storeContext(queryClient: QueryClient, context: OrganizationContext): void {
  queryClient.setQueryData(queryKeys.organizationBySlug(context.organization.slug), context);
  queryClient.setQueryData<OrganizationContext[]>(queryKeys.myOrganizations(), (list) =>
    list
      ? [
          ...list.filter((entry) => entry.organization.id !== context.organization.id),
          context,
        ].sort(byName)
      : list,
  );
}

/** Drops a practice the caller no longer belongs to (deleted) from the caches. */
function forgetOrganization(queryClient: QueryClient, organization: Organization): void {
  queryClient.setQueryData<OrganizationContext[]>(queryKeys.myOrganizations(), (list) =>
    list?.filter((entry) => entry.organization.id !== organization.id),
  );
  // Marked stale, not removed: the organization route may still be mounted for a moment
  // and must not refetch (and flash "not found") while the app navigates away.
  void queryClient.invalidateQueries({
    queryKey: queryKeys.organizationBySlug(organization.slug),
    refetchType: 'none',
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.myOrganizations(),
    exact: true,
    refetchType: 'none',
  });
  queryClient.removeQueries({ queryKey: queryKeys.org.all(organization.id) });
}

/** The caller's organizations, ordered by name, each with the caller's role and permissions. */
export function useMyOrganizations(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.myOrganizations(),
    queryFn: ({ signal }) => organizationsApi.listMine(signal),
    enabled: options.enabled ?? true,
  });
}

/**
 * Resolves the slug of the URL to the organization and the caller's access. 404 for a non-member.
 *
 * The caller's list already holds the same shape, and the shell asks for it on every cold load:
 * the slug is looked up in that list (sharing its request when it is still on its way), so a page
 * load costs one request instead of two. A slug that is not in the list (a practice created a
 * moment ago, or one the caller does not belong to) is asked for by itself.
 */
export function useOrganizationBySlug(slug: string | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.organizationBySlug(slug ?? ''),
    queryFn: async ({ signal }) => {
      const mine = await queryClient
        .query({
          queryKey: queryKeys.myOrganizations(),
          queryFn: ({ signal: listSignal }) => organizationsApi.listMine(listSignal),
        })
        .catch(() => undefined);
      return (
        mine?.find((entry) => entry.organization.slug === slug) ??
        organizationsApi.getBySlug(slug ?? '', signal)
      );
    },
    enabled: Boolean(slug),
    // The list already holds the same shape: use it so switching organization is instant.
    initialData: () =>
      queryClient
        .getQueryData<OrganizationContext[]>(queryKeys.myOrganizations())
        ?.find((entry) => entry.organization.slug === slug),
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(queryKeys.myOrganizations())?.dataUpdatedAt,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOrganizationBody) => organizationsApi.create(body),
    onSuccess: (context) => {
      storeContext(queryClient, context);
      void queryClient.invalidateQueries({ queryKey: queryKeys.myOrganizations(), exact: true });
    },
  });
}

export function useUpdateOrganization(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: OrganizationUpdate) => organizationsApi.update(organizationId, body),
    // Not optimistic: both caches are updated from the response.
    onSuccess: (organization) => {
      const merge = (context: OrganizationContext): OrganizationContext =>
        context.organization.id === organization.id ? { ...context, organization } : context;
      queryClient.setQueryData<OrganizationContext>(
        queryKeys.organizationBySlug(organization.slug),
        (context) => (context ? merge(context) : context),
      );
      queryClient.setQueryData<OrganizationContext[]>(queryKeys.myOrganizations(), (list) =>
        list?.map(merge).sort(byName),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.org.detail(organization.id) });
    },
  });
}

export function useDeleteOrganization(organization: Organization) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (confirmName: string) => organizationsApi.remove(organization.id, confirmName),
    onSuccess: () => forgetOrganization(queryClient, organization),
  });
}
