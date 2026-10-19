import { Badge } from '@/components/ui';

import {
  BILLING_STATUS_LABEL,
  BILLING_STATUS_TONE,
  SHEET_STATUS_LABEL,
  SHEET_STATUS_TONE,
} from '../constants';
import type { BillingStatus, MissingStatus, TimesheetStatus } from '../types';

/** The status of a timesheet as a pill; the text always says it ("rejected" reads "Returned"). */
export function SheetStatusBadge({ status }: { status: TimesheetStatus | MissingStatus }) {
  return (
    <Badge tone={SHEET_STATUS_TONE[status]} size="sm" dot>
      {SHEET_STATUS_LABEL[status]}
    </Badge>
  );
}

export function BillingStatusBadge({ status }: { status: BillingStatus }) {
  return (
    <Badge tone={BILLING_STATUS_TONE[status]} size="sm">
      {BILLING_STATUS_LABEL[status]}
    </Badge>
  );
}

export function BillableBadge({ billable }: { billable: boolean }) {
  return (
    <Badge tone={billable ? 'green' : 'grey'} size="sm">
      {billable ? 'Billable' : 'Non-billable'}
    </Badge>
  );
}
