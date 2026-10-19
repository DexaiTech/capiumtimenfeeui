import { api } from '@/services/api';
import type { Organization, OrganizationContext, OrganizationUpdate } from '@/types/organization';

const orgPath = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;

/** Body of POST /organizations (open deployments only). */
export interface CreateOrganizationBody {
  name: string;
  slug?: string;
  timezone?: string;
  currency?: string;
  vat_registered?: boolean;
}

/** Typed wrappers over the practice endpoints (`app/api/v1/organizations.py`). */
export const organizationsApi = {
  // A small, bounded collection: active memberships only, not paginated.
  listMine: (signal?: AbortSignal) =>
    api.get<OrganizationContext[]>('/users/me/organizations', { signal }),
  getBySlug: (slug: string, signal?: AbortSignal) =>
    api.get<OrganizationContext>(`/organizations/by-slug/${encodeURIComponent(slug)}`, { signal }),
  create: (body: CreateOrganizationBody) => api.post<OrganizationContext>('/organizations', body),
  update: (organizationId: string, body: OrganizationUpdate) =>
    api.patch<Organization>(orgPath(organizationId), body),
  remove: (organizationId: string, confirmName: string) =>
    api.request<null>(orgPath(organizationId), {
      method: 'DELETE',
      body: { confirm_name: confirmName },
    }),
};
