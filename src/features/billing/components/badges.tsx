import { Badge } from '@/components/ui';

import {
  INVOICE_STATUS_LABELS,
  PAYMENT_STATE_LABELS,
  WIP_KIND_LABELS,
  type LabelTone,
} from '../constants';
import type { InvoiceDisplayStatus, PaymentState, WipItemKind } from '../types';

const UNKNOWN: Pick<LabelTone, 'tone'> = { tone: 'grey' };

/** The status of an invoice as a pill: text and colour, so colour is never the only signal. */
export function InvoiceStatusBadge({ status }: { status: InvoiceDisplayStatus }) {
  // The API may one day name a status this build does not know: show it as it is.
  const info = (INVOICE_STATUS_LABELS as Partial<Record<string, LabelTone>>)[status];
  return (
    <Badge tone={info?.tone ?? UNKNOWN.tone} size="sm" dot>
      {info?.label ?? status}
    </Badge>
  );
}

export function PaymentStateBadge({ state }: { state: PaymentState }) {
  const info = (PAYMENT_STATE_LABELS as Partial<Record<string, LabelTone>>)[state];
  return (
    <Badge tone={info?.tone ?? UNKNOWN.tone} size="sm" dot>
      {info?.label ?? state}
    </Badge>
  );
}

export function WipKindBadge({ kind }: { kind: WipItemKind }) {
  const info = (WIP_KIND_LABELS as Partial<Record<string, LabelTone>>)[kind];
  return (
    <Badge tone={info?.tone ?? UNKNOWN.tone} size="sm">
      {info?.label ?? kind}
    </Badge>
  );
}
