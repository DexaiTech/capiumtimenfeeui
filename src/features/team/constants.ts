import type {
  ChangeAction,
  LoginStatus,
  RateKind,
  RateLevel,
  RuleStatus,
  StaffStatus,
} from './types';

export const STAFF_STATUS_LABEL: Record<StaffStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  left: 'Left',
};

export const LOGIN_STATUS_LABEL: Record<LoginStatus, string> = {
  active: 'Linked',
  invited: 'Invited',
  none: 'No login',
};

export const RULE_STATUS_LABEL: Record<RuleStatus, string> = {
  current: 'Current',
  future: 'Future',
  ended: 'Ended',
};

export const RATE_KIND_LABEL: Record<RateKind, string> = {
  charge: 'Charge-out',
  cost: 'Cost',
};

export const CHANGE_ACTION_LABEL: Record<ChangeAction, string> = {
  created: 'Created',
  updated: 'Changed',
  end_dated: 'End-dated',
  deleted: 'Deleted',
};

/** Where a history row came from (`RateChange.source`). */
export const CHANGE_SOURCE_LABEL: Record<string, string> = {
  rates: 'Rates',
  staff_rates: 'Staff rates (V1)',
  client_rates: 'Client rates (V1)',
  grade_default: 'Grade default',
};

/** What a charge-out source or ladder origin is called (`charge_source`, `LadderStep.origin`). */
export const ORIGIN_LABEL: Record<string, string> = {
  rule: 'Dated rate',
  job: 'Job rate',
  grade_default: 'Grade default',
  practice_default: 'Practice default',
  none: 'None',
};

/** Why an entry is left alone by a re-rate (`skipped` of a preview, `skip_reason` of an entry). */
export const SKIP_REASON_LABEL: Record<string, string> = {
  billed: 'Already billed',
  in_draft: 'On a draft invoice',
  written_off: 'Written off',
  period_locked: 'In a locked period',
};

/** The fields a rate scope names; which are set decides the level. */
export interface ScopeNeeds {
  client: boolean;
  service: boolean;
  staff: boolean;
  grade: boolean;
}

export interface ScopeOption {
  level: RateLevel;
  label: string;
  /** What the level means, in a sentence. */
  help: string;
  needs: ScopeNeeds;
  /** Position in the charge-out ladder (1 = most specific). */
  precedence: number;
}

/** The levels of a rate rule, most specific first. Cost rates exist only for staff and grades. */
export const SCOPE_OPTIONS: ReadonlyArray<ScopeOption> = [
  {
    level: 'client_service_staff',
    label: 'Client + service + staff',
    help: 'One person, on one service, for one client.',
    needs: { client: true, service: true, staff: true, grade: false },
    precedence: 1,
  },
  {
    level: 'client_service',
    label: 'Client + service',
    help: 'Everyone, on one service, for one client.',
    needs: { client: true, service: true, staff: false, grade: false },
    precedence: 2,
  },
  {
    level: 'client_staff',
    label: 'Client + staff',
    help: 'One person, on any service, for one client.',
    needs: { client: true, service: false, staff: true, grade: false },
    precedence: 3,
  },
  {
    level: 'client',
    label: 'Client (everyone)',
    help: 'Everyone, on any service, for one client. Used after a rate for the person.',
    needs: { client: true, service: false, staff: false, grade: false },
    precedence: 3,
  },
  {
    level: 'service_staff',
    label: 'Staff + service',
    help: 'One person, on one service, for every client. Used before the rate for their grade.',
    needs: { client: false, service: true, staff: true, grade: false },
    precedence: 5,
  },
  {
    level: 'service_grade',
    label: 'Service + grade',
    help: 'Everyone of a grade, on one service.',
    needs: { client: false, service: true, staff: false, grade: true },
    precedence: 5,
  },
  {
    level: 'staff',
    label: 'Staff',
    help: 'One person, whatever the client or service.',
    needs: { client: false, service: false, staff: true, grade: false },
    precedence: 6,
  },
  {
    level: 'grade',
    label: 'Grade',
    help: 'Everyone of a grade, whatever the client or service.',
    needs: { client: false, service: false, staff: false, grade: true },
    precedence: 7,
  },
];

/** Cost rates can only be set for a person or a grade. */
export const COST_LEVELS: ReadonlyArray<RateLevel> = ['staff', 'grade'];

export function scopeOptionsFor(kind: RateKind): ReadonlyArray<ScopeOption> {
  return kind === 'cost'
    ? SCOPE_OPTIONS.filter((option) => COST_LEVELS.includes(option.level))
    : SCOPE_OPTIONS;
}

/** The order the charge-out rate is chosen in (docs/domain.md, "Rates"), for the help panel. */
export const CHARGE_LADDER: ReadonlyArray<{ position: number; title: string; help: string }> = [
  {
    position: 1,
    title: 'Client + service + staff',
    help: 'A rate for one person on one service of one client.',
  },
  { position: 2, title: 'Client + service', help: 'A rate for one service of one client.' },
  {
    position: 3,
    title: 'Client + staff',
    help: 'A rate for one person on one client, else the client’s rate for everyone.',
  },
  { position: 4, title: 'Job rate', help: 'The hourly rate set on the job itself.' },
  {
    position: 5,
    title: 'Service rate for the person',
    help: 'The person’s own rate for the job’s service, else the rate for their grade on it.',
  },
  { position: 6, title: 'Staff rate', help: 'The person’s own rate.' },
  {
    position: 7,
    title: 'Grade rate',
    help: 'A grade rate in force, else the grade’s default charge-out rate.',
  },
];
