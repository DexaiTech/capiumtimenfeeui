import { Badge, type BadgeTone } from '@/components/ui';

import { CLIENT_STATUS_LABELS, CLIENT_TYPE_LABELS, labelOf } from '../constants';
import type { LabelTone } from './constants';

const TYPE_TONES: Record<string, BadgeTone> = {
  limited_company: 'orange',
  sole_trader: 'blue',
  partnership: 'violet',
  llp: 'green',
  individual: 'bronze',
  charity: 'green',
  trust: 'violet',
};

const STATUS_TONES: Record<string, BadgeTone> = {
  active: 'green',
  prospect: 'violet',
  inactive: 'amber',
  archived: 'grey',
};

const SEGMENT_TONES: Record<string, BadgeTone> = {
  bronze: 'bronze',
  silver: 'grey',
  gold: 'amber',
  platinum: 'violet',
};

export function ClientTypeBadge({ type }: { type: string }) {
  return (
    <Badge tone={TYPE_TONES[type] ?? 'grey'} size="sm">
      {labelOf(CLIENT_TYPE_LABELS, type)}
    </Badge>
  );
}

export function ClientStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONES[status] ?? 'grey'} size="sm" dot>
      {labelOf(CLIENT_STATUS_LABELS, status)}
    </Badge>
  );
}


export function SegmentBadge({ segment }: { segment: string }) {
  return (
    <Badge tone={SEGMENT_TONES[segment.toLowerCase()] ?? 'violet'} size="sm">
      {segment}
    </Badge>
  );
}

/** A status of a record (job, invoice, payment, billing status) as a pill; the text always says it. */
export function ToneBadge({ info }: { info: LabelTone }) {
  return (
    <Badge tone={info.tone} size="sm">
      {info.label}
    </Badge>
  );
}
