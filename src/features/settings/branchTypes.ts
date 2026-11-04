/**
 * Shapes of the branch endpoints (`app/schemas/branches.py`) behind Settings → Branches and the
 * branch pick on the client form (ticket APT74).
 */
import type { IsoDateTime } from '@/types/api';

/** A branch (office) of the practice (`BranchRead`). */
export interface Branch {
  id: string;
  name: string;
  is_active: boolean;
  /** Live clients in the branch; null for a member without `client.read`. */
  client_count: number | null;
  /** False once clients have it: DELETE then deactivates. */
  can_delete: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface BranchCreate {
  name: string;
}

/** PATCH is partial. */
export interface BranchUpdate {
  name?: string;
  is_active?: boolean;
}
