import type { ReactNode } from 'react';

import { Modal } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { formatUkDate, formatUkDateTime } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { COMPONENT_LABEL, ITEM_KIND_META, TRANSFER_STATUS_META } from '../constants';
import type { Transfer } from '../types';
import { jobText, personName } from '../utils/format';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[10rem_1fr] sm:gap-3">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm break-words text-text">{children}</dd>
    </div>
  );
}

export interface TransferDetailsDialogProps {
  transfer: Transfer | null;
  onClose: () => void;
}

/** One transfer with the items it moved and, when it was reversed, who reversed it and why. */
export function TransferDetailsDialog({ transfer, onClose }: TransferDetailsDialogProps) {
  const { organization } = useOrg();
  const { currency, timezone } = organization;
  return (
    <Modal
      open={transfer !== null}
      onClose={onClose}
      title="WIP transfer"
      description={transfer ? TRANSFER_STATUS_META[transfer.status].label : undefined}
      size="md"
    >
      {transfer ? (
        <dl className="flex flex-col gap-3">
          <Row label="Client">{transfer.client?.name ?? '—'}</Row>
          <Row label="From">{jobText(transfer.from_job)}</Row>
          <Row label="To">{jobText(transfer.to_job)}</Row>
          <Row label="Kind of WIP">{COMPONENT_LABEL[transfer.component]}</Row>
          <Row label="Amount">{formatMoney(transfer.amount, currency)}</Row>
          <Row label="Effective date">{formatUkDate(transfer.effective_date)}</Row>
          <Row label="Reason">{transfer.reason}</Row>
          <Row label="Made">
            {personName(transfer.created_by)} on {formatUkDateTime(transfer.created_at, timezone)}
          </Row>
          {transfer.reversed_by ? (
            <Row label="Reversed">
              {personName(transfer.reversed_by)} on{' '}
              {formatUkDateTime(transfer.reversed_at, timezone)}
              {transfer.reversal_reason ? `: ${transfer.reversal_reason}` : ''}
            </Row>
          ) : null}
          <Row label="Items">
            {transfer.items.length === 0 ? (
              'Moved by amount, not by item.'
            ) : (
              <ul className="flex flex-col gap-1">
                {transfer.items.map((entry) => (
                  <li key={`${entry.kind}:${entry.id}`}>
                    {ITEM_KIND_META[entry.kind].label}: {formatMoney(entry.value, currency)}
                  </li>
                ))}
              </ul>
            )}
          </Row>
        </dl>
      ) : null}
    </Modal>
  );
}
