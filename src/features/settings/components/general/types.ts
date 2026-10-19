import type { Organization } from '@/types/organization';

/** The props of every card of the General Settings page. */
export interface GeneralCardProps {
  organization: Organization;
  /** False shows the saved values read-only (the role cannot update the practice). */
  editable: boolean;
}
