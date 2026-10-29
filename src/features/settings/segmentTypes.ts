/**
 * Shapes of the segment endpoints (`app/schemas/segments.py`) behind Settings → Client Segments
 * and the segment picks on the client form and the staff screen.
 */
import type { IsoDateTime } from '@/types/api';

/** A client segment of the practice (`SegmentRead`). */
export interface Segment {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  /** Live clients with the segment (matched ignoring case). */
  client_count: number;
  /** Staff who have not left. */
  staff_count: number;
  /** False once clients use it: DELETE then deactivates. */
  can_delete: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface SegmentCreate {
  name: string;
  description?: string | null;
}

/** PATCH is partial; `description` takes null to clear it. */
export interface SegmentUpdate {
  name?: string;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

/** `GET /staff/{id}/segments`: what a staff member looks after. */
export interface StaffSegments {
  segments: Segment[];
  /** Live clients in any of those segments, each counted once. */
  client_count: number;
}
