import { http, type HttpHandler } from 'msw';

import type { Segment, StaffSegments } from '@/features/settings';

import { orgApiPath } from './renderInOrg';
import { fail, ok } from './server';

interface SegmentCreate {
  name: string;
  description?: string | null;
}
type SegmentUpdate = Partial<Pick<Segment, 'name' | 'description' | 'sort_order' | 'is_active'>>;

export { orgApiPath };

const STAMP = '2026-10-01T09:00:00Z';

export function segment(id: string, name: string, extra: Partial<Segment> = {}): Segment {
  return {
    id,
    name,
    description: null,
    is_active: true,
    sort_order: 0,
    client_count: 0,
    staff_count: 0,
    can_delete: true,
    created_at: STAMP,
    updated_at: STAMP,
    ...extra,
  };
}

export const gold = segment('seg-gold', 'Gold', {
  description: 'Our largest fee payers',
  client_count: 3,
  staff_count: 1,
  can_delete: false,
});
export const silver = segment('seg-silver', 'Silver', { client_count: 1, can_delete: false });
export const retail = segment('seg-retail', 'Retail', { is_active: false });

export const testSegments: Segment[] = [gold, silver, retail];

/** The requests the fake API has seen, for assertions on exact bodies. */
export interface SegmentCalls {
  creates: SegmentCreate[];
  updates: Array<{ id: string; body: SegmentUpdate }>;
  deletes: string[];
  staffSets: Array<{ userId: string; segmentIds: string[] }>;
}

export function newSegmentCalls(): SegmentCalls {
  return { creates: [], updates: [], deletes: [], staffSets: [] };
}

/**
 * A fake of the segment endpoints that keeps its own state: what a test creates, renames or
 * deletes shows up in the next list. `held` is the segment ids each staff member looks after.
 */
export function segmentHandlers(
  initial: Segment[] = testSegments,
  calls: SegmentCalls = newSegmentCalls(),
  held: Record<string, string[]> = {},
): HttpHandler[] {
  let segments = initial.map((entry) => ({ ...entry }));
  const staffView = (userId: string): StaffSegments => {
    const own = segments.filter((entry) => (held[userId] ?? []).includes(entry.id));
    return { segments: own, client_count: own.reduce((sum, entry) => sum + entry.client_count, 0) };
  };

  return [
    http.get(orgApiPath('/segments'), () => ok(segments)),
    http.post(orgApiPath('/segments'), async ({ request }) => {
      const body = (await request.json()) as SegmentCreate;
      calls.creates.push(body);
      if (segments.some((entry) => entry.name.toLowerCase() === body.name.toLowerCase())) {
        return fail(409, 'SEGMENT_NAME_TAKEN', 'A segment with this name already exists.', {
          details: [
            {
              field: 'name',
              code: 'duplicate',
              message: 'A segment with this name already exists.',
            },
          ],
        });
      }
      const created = segment(`seg-${segments.length + 1}`, body.name, {
        description: body.description ?? null,
      });
      segments = [...segments, created];
      return ok(created, { status: 201 });
    }),
    http.patch(orgApiPath('/segments/:id'), async ({ params, request }) => {
      const body = (await request.json()) as SegmentUpdate;
      const id = String(params.id);
      calls.updates.push({ id, body });
      const current = segments.find((entry) => entry.id === id);
      if (!current) return fail(404, 'NOT_FOUND', 'Segment not found.');
      const next = { ...current, ...body };
      segments = segments.map((entry) => (entry.id === id ? next : entry));
      return ok(next);
    }),
    http.delete(orgApiPath('/segments/:id'), ({ params }) => {
      const id = String(params.id);
      calls.deletes.push(id);
      const current = segments.find((entry) => entry.id === id);
      if (!current) return fail(404, 'NOT_FOUND', 'Segment not found.');
      if (current.client_count > 0) {
        segments = segments.map((entry) =>
          entry.id === id ? { ...entry, is_active: false } : entry,
        );
        return ok({ outcome: 'deactivated', id });
      }
      segments = segments.filter((entry) => entry.id !== id);
      return ok({ outcome: 'deleted', id });
    }),
    http.get(orgApiPath('/staff/:userId/segments'), ({ params }) =>
      ok(staffView(String(params.userId))),
    ),
    http.put(orgApiPath('/staff/:userId/segments'), async ({ params, request }) => {
      const userId = String(params.userId);
      const body = (await request.json()) as { segment_ids: string[] };
      calls.staffSets.push({ userId, segmentIds: body.segment_ids });
      held[userId] = body.segment_ids;
      return ok(staffView(userId));
    }),
  ];
}
