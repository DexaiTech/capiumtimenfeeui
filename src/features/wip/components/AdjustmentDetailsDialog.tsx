import type { ReactNode } from 'react';

import { Modal } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { formatUkDate, formatUkDateTime } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { ADJUSTMENT_KIND_META, ADJUSTMENT_STATUS_META, COMPONENT_LABEL } from '../constants';
import type { Adjustment } from '../types';
import { jobText, personName, signedMoney } from '../utils/format';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[10rem_1fr] sm:gap-3">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm break-words text-text">{children}</dd>
    </div>
  );
}

export interface AdjustmentDetailsDialogProps {
  adjustment: Adjustment | null;
  onClose: () => void;
}

/** One adjustment with its trail: who asked, who decided, who reversed, and why. */
export function AdjustmentDetailsDialog({ adjustment, onClose }: AdjustmentDetailsDialogProps) {
  const { organization } = useOrg();
  const { currency, timezone } = organization;
  return (
    <Modal
      open={adjustment !== null}
      onClose={onClose}
      title="WIP adjustment"
      description={adjustment ? ADJUSTMENT_STATUS_META[adjustment.status].label : undefined}
      size="md"
    >
      {adjustment ? (
        <dl className="flex flex-col gap-3">
          <Row label="Client">{adjustment.client?.name ?? '—'}</Row>
          <Row label="Job">
            {adjustment.job ? jobText(adjustment.job) : 'The client as a whole'}
          </Row>
          <Row label="Adjustment">
            {ADJUSTMENT_KIND_META[adjustment.kind].label} of {COMPONENT_LABEL[adjustment.component]}{' '}
            WIP
          </Row>
          <Row label="Amount">{signedMoney(adjustment.signed_amount, currency)}</Row>
          <Row label="Effective date">{formatUkDate(adjustment.effective_date)}</Row>
          <Row label="Reason">{adjustment.reason}</Row>
          <Row label="Requested">
            {personName(adjustment.requested_by)} on{' '}
            {formatUkDateTime(adjustment.requested_at, timezone)}
          </Row>
          {adjustment.approval_required ? (
            <Row label="Approval">
              Needed: above the {formatMoney(adjustment.threshold, currency)} limit
            </Row>
          ) : null}
          {adjustment.decided_by ? (
            <Row label="Decided">
              {personName(adjustment.decided_by)} on{' '}
              {formatUkDateTime(adjustment.decided_at, timezone)}
              {adjustment.decision_note ? `: ${adjustment.decision_note}` : ''}
            </Row>
          ) : null}
          {adjustment.reversed_by ? (
            <Row label="Reversed">
              {personName(adjustment.reversed_by)} on{' '}
              {formatUkDateTime(adjustment.reversed_at, timezone)}
              {adjustment.reversal_reason ? `: ${adjustment.reversal_reason}` : ''}
            </Row>
          ) : null}
          {adjustment.status === 'approved' ? (
            <Row label="Counts in the WIP">
              {adjustment.in_force
                ? 'Yes, until the job is next billed'
                : 'No, billing has settled it'}
            </Row>
          ) : null}
        </dl>
      ) : null}
    </Modal>
  );
}
