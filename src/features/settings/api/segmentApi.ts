import { api } from '@/services/api';

import type { DeleteOutcome } from '../billingTypes';
import type { Segment, SegmentCreate, SegmentUpdate, StaffSegments } from '../segmentTypes';

const org = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;
const id = encodeURIComponent;

/** Typed wrappers over the segment endpoints. */
export const segmentApi = {
  // A bounded list: the API returns every segment at once.
  list: (organizationId: string, signal?: AbortSignal) =>
    api.get<Segment[]>(`${org(organizationId)}/segments`, { signal }),
  create: (organizationId: string, body: SegmentCreate) =>
    api.post<Segment>(`${org(organizationId)}/segments`, body),
  update: (organizationId: string, segmentId: string, body: SegmentUpdate) =>
    api.patch<Segment>(`${org(organizationId)}/segments/${id(segmentId)}`, body),
  remove: (organizationId: string, segmentId: string) =>
    api.delete<DeleteOutcome>(`${org(organizationId)}/segments/${id(segmentId)}`),

  staffSegments: (organizationId: string, userId: string, signal?: AbortSignal) =>
    api.get<StaffSegments>(`${org(organizationId)}/staff/${id(userId)}/segments`, { signal }),
  setStaffSegments: (organizationId: string, userId: string, segmentIds: string[]) =>
    api.put<StaffSegments>(`${org(organizationId)}/staff/${id(userId)}/segments`, {
      segment_ids: segmentIds,
    }),
};
