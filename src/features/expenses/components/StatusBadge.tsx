import { Badge } from '@/components/ui';

import { BILLING_STATUS_META, CLAIM_STATUS_META } from '../constants';
import type { BillingStatus, ClaimStatus } from '../types';

/** The status of a claim as a pill: the word, with the colour as a second cue. */
export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  const meta = CLAIM_STATUS_META[status];
  return (
    <Badge tone={meta.tone} size="sm" dot>
      {meta.label}
    </Badge>
  );
}

/** Where a line stands with billing: unbilled, on a draft invoice, billed or written off. */
export function BillingBadge({ status }: { status: BillingStatus }) {
  const meta = BILLING_STATUS_META[status];
  return (
    <Badge tone={meta.tone} size="sm">
      {meta.label}
    </Badge>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge tone={active ? 'green' : 'grey'} size="sm" dot>
      {active ? 'Active' : 'Inactive'}
    </Badge>
  );
}
