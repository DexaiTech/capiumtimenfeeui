import { Badge, type BadgeTone } from '@/components/ui';

import {
  CHANGE_ACTION_LABEL,
  LOGIN_STATUS_LABEL,
  RULE_STATUS_LABEL,
  STAFF_STATUS_LABEL,
} from '../constants';
import type { ChangeAction, LoginStatus, RuleStatus, StaffStatus } from '../types';

const STAFF_TONE: Record<StaffStatus, BadgeTone> = {
  active: 'success',
  inactive: 'warning',
  left: 'neutral',
};

export function StaffStatusBadge({ status }: { status: StaffStatus }) {
  return <Badge tone={STAFF_TONE[status]}>{STAFF_STATUS_LABEL[status]}</Badge>;
}

const LOGIN_TONE: Record<LoginStatus, BadgeTone> = {
  active: 'success',
  invited: 'warning',
  none: 'neutral',
};

export function LoginStatusBadge({ status }: { status: LoginStatus }) {
  return <Badge tone={LOGIN_TONE[status]}>{LOGIN_STATUS_LABEL[status]}</Badge>;
}

const RULE_TONE: Record<RuleStatus, BadgeTone> = {
  current: 'success',
  future: 'info',
  ended: 'neutral',
};

export function RuleStatusBadge({ status }: { status: RuleStatus }) {
  return <Badge tone={RULE_TONE[status]}>{RULE_STATUS_LABEL[status]}</Badge>;
}

/** Active or inactive: grades, services and activity types. */
export function ActiveBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? 'success' : 'neutral'}>{active ? 'Active' : 'Inactive'}</Badge>;
}

const ACTION_TONE: Record<ChangeAction, BadgeTone> = {
  created: 'success',
  updated: 'info',
  end_dated: 'warning',
  deleted: 'danger',
};

export function ChangeActionBadge({ action }: { action: ChangeAction }) {
  return <Badge tone={ACTION_TONE[action]}>{CHANGE_ACTION_LABEL[action]}</Badge>;
}
