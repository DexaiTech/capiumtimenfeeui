import { useRef, useState } from 'react';
import { Link } from 'react-router';

import { Popover } from '@/components/ui';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { cn } from '@/utils/cn';

import { useClient } from '../api';
import { centralChip, type CentralTone } from '../central/format';
import {
  AML_LABELS,
  CLIENT_STATUS_LABELS,
  CLIENT_TYPE_LABELS,
  labelOf,
  SOFTWARE_LABELS,
} from '../constants';
import { avatarColor, deadlinePill, healthTone } from '../format';
import type { ClientRead, Deadlines, ServiceTag } from '../types';

export interface InitialsProps {
  name: string;
  initials?: string | null;
  size?: 'sm' | 'md' | 'lg';
  /** A fixed colour (the light contact avatar); else one from the name hash. */
  color?: string;
}

/** Round initials avatar. Decorative: the name is always shown next to it. */
export function Initials({ name, initials, size = 'md', color }: InitialsProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'cc-avatar',
        size === 'sm' && 'cc-avatar--sm',
        size === 'lg' && 'cc-avatar--lg',
      )}
      style={{ background: color ?? avatarColor(name) }}
    >
      {(initials ?? '').slice(0, 2) || '?'}
    </span>
  );
}

const TYPE_TONES: Record<string, string> = {
  limited_company: 'cc-badge--warning',
  sole_trader: 'cc-badge--info',
  partnership: 'cc-badge--violet',
  llp: 'cc-badge--success',
  individual: 'cc-badge--bronze',
  charity: 'cc-badge--success',
  trust: 'cc-badge--violet',
};

export function TypeBadge({ type }: { type: string }) {
  return (
    <span className={cn('cc-badge', TYPE_TONES[type])}>{labelOf(CLIENT_TYPE_LABELS, type)}</span>
  );
}

export function SoftwareBadge({ software }: { software: string | null }) {
  if (!software) return null;
  if (software === 'xero') {
    return (
      <span className="cc-badge cc-badge--xero" title="Xero">
        xero
      </span>
    );
  }
  const label = labelOf(SOFTWARE_LABELS, software);
  return (
    <span className="cc-badge" title={label}>
      {label}
    </span>
  );
}

const SEGMENT_TONES: Record<string, string> = {
  bronze: 'cc-pill--bronze',
  silver: 'cc-pill--silver',
  gold: 'cc-pill--gold',
  platinum: 'cc-pill--violet',
};

export function SegmentPill({ segment }: { segment: string | null }) {
  if (!segment) return <span className="cc-muted">—</span>;
  return <span className={cn('cc-pill', SEGMENT_TONES[segment.toLowerCase()])}>{segment}</span>;
}

export function HealthCell({ score }: { score: number | null }) {
  if (score === null) return <span className="cc-muted">—</span>;
  const tone = healthTone(score);
  return (
    <span className="cc-health">
      <span className="cc-health-text">
        <strong className={`cc-tone-${tone}`}>{score}</strong>/100
      </span>
      <span
        className="cc-health-track"
        role="meter"
        aria-label="Health score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
      >
        <span
          className={`cc-health-fill cc-fill-${tone}`}
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </span>
    </span>
  );
}

const AML_TONES: Record<string, string> = {
  clear: 'cc-pill--success',
  pending: 'cc-pill--warning',
  review: 'cc-pill--info',
  failed: 'cc-pill--danger',
  not_started: '',
};

export function AmlPill({ status }: { status: string }) {
  return <span className={cn('cc-pill', AML_TONES[status])}>{labelOf(AML_LABELS, status)}</span>;
}

const STATUS_TONES: Record<string, string> = {
  active: 'cc-pill--success',
  prospect: 'cc-pill--violet',
  inactive: 'cc-pill--warning',
  archived: '',
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={cn('cc-pill', STATUS_TONES[status])}>
      {labelOf(CLIENT_STATUS_LABELS, status)}
    </span>
  );
}

export function DeadlineCell({ deadlines, today }: { deadlines: Deadlines; today: string }) {
  const pill = deadlinePill(deadlines, today);
  if (!pill) return null;
  return (
    <span
      className={cn('cc-pill', pill.tone === 'danger' ? 'cc-pill--danger' : 'cc-pill--warning')}
    >
      {pill.label}
    </span>
  );
}

const CENTRAL_TONES: Record<CentralTone, string> = {
  success: 'cc-pill--success',
  warning: 'cc-pill--warning',
  danger: 'cc-pill--danger',
  neutral: '',
};

/** The Central column: `Local`, `Linked`, `Synced dd/MM/yyyy`, `Stale` or `Not found centrally`. */
export function CentralCell({
  client,
  timeZone,
}: {
  client: Pick<ClientRead, 'central_client_id' | 'central_sync_state' | 'central_synced_at'>;
  timeZone: string;
}) {
  const info = centralChip(client, timeZone);
  return (
    <span className={cn('cc-pill', CENTRAL_TONES[info.tone])} title={info.title}>
      {info.label}
    </span>
  );
}

/**
 * "Merged into <name>" for a client the central service merged into another: its work moved
 * there. The name is looked up (merged-away clients are few), the link opens the survivor.
 */
export function MergedNote({ clientId }: { clientId: string }) {
  const { organization } = useOrg();
  const survivor = useClient(clientId);
  return (
    <span className="cc-muted">
      Merged into{' '}
      <Link
        className="cc-link"
        to={routes.org.client(organization.slug, clientId, 'overview')}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {survivor.data?.name ?? 'another client'}
      </Link>
    </span>
  );
}

/** First service chip and a "+N" chip that lists every service on hover, focus or click. */
export function ServicesCell({ services }: { services: ServiceTag[] }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [first, ...rest] = services;
  if (!first) return <span className="cc-muted">—</span>;
  return (
    <span className="cc-services">
      <span className="cc-pill cc-pill--violet" title={first.name}>
        {first.name}
      </span>
      {rest.length > 0 ? (
        <>
          <button
            ref={anchorRef}
            type="button"
            className="cc-chip-button"
            aria-label={`Show all ${services.length} services`}
            aria-expanded={open}
            onClick={(event) => {
              event.stopPropagation();
              setOpen((value) => !value);
            }}
            onKeyDown={(event) => event.stopPropagation()}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            <span className="cc-pill cc-pill--outline">+{rest.length}</span>
          </button>
          <Popover
            open={open}
            onClose={() => setOpen(false)}
            anchorRef={anchorRef}
            label="Services"
            role="group"
            align="end"
            className="capium-clients cc-popover"
          >
            <ul className="cc-services-list" aria-label="Services">
              {services.map((service) => (
                <li key={service.service_id} className="cc-pill cc-pill--violet">
                  {service.name}
                </li>
              ))}
            </ul>
          </Popover>
        </>
      ) : null}
    </span>
  );
}
