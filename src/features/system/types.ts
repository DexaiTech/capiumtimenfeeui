/** Shapes of the milestone 11 contract (docs/api.md, "Milestone 11 contract: closed deployment"). */

export interface SystemOrganization {
  name: string;
  slug: string;
}

export interface SystemInfo {
  closed_deployment: boolean;
  /** The single organization when `closed_deployment` is true, otherwise null. */
  organization: SystemOrganization | null;
}
