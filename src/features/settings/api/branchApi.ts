import { api } from '@/services/api';

import type { DeleteOutcome } from '../billingTypes';
import type { Branch, BranchCreate, BranchUpdate } from '../branchTypes';

const org = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;
const id = encodeURIComponent;

/** Typed wrappers over the branch endpoints. */
export const branchApi = {
  // A bounded list: the API returns every branch at once.
  list: (organizationId: string, signal?: AbortSignal) =>
    api.get<Branch[]>(`${org(organizationId)}/branches`, { signal }),
  create: (organizationId: string, body: BranchCreate) =>
    api.post<Branch>(`${org(organizationId)}/branches`, body),
  update: (organizationId: string, branchId: string, body: BranchUpdate) =>
    api.patch<Branch>(`${org(organizationId)}/branches/${id(branchId)}`, body),
  remove: (organizationId: string, branchId: string) =>
    api.delete<DeleteOutcome>(`${org(organizationId)}/branches/${id(branchId)}`),
};
