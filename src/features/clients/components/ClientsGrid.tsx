import type { ReactNode } from 'react';

import { RowActions } from '@/components/ui';
import { useBranchesEnabled, useSegmentsEnabled } from '@/features/settings';

import { formatActivity } from '../format';
import type { ClientListItem } from '../types';
import { type MenuAction } from './ActionMenu';
import {
  Initials,
  MergedNote,
  SegmentPill,
  ServicesCell,
  SoftwareBadge,
  TypeBadge,
} from './ClientCells';

export interface ClientsGridProps {
  rows: ClientListItem[];
  selected: ReadonlySet<string>;
  onToggle: (clientId: string, checked: boolean) => void;
  onOpen: (client: ClientListItem) => void;
  actionsFor: (client: ClientListItem) => MenuAction[];
  timeZone: string;
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  placeholder?: ReactNode;
}

/** The grid view: one card per client with the same data as the table row (APT76: no contact,
 * deadlines or Central). */
export function ClientsGrid({
  rows,
  selected,
  onToggle,
  onOpen,
  actionsFor,
  timeZone,
  loading,
  hasMore,
  loadingMore,
  onLoadMore,
  placeholder,
}: ClientsGridProps) {
  const segmentsOn = useSegmentsEnabled();
  const branchesOn = useBranchesEnabled();
  if (placeholder) return <div className="cc-table-card">{placeholder}</div>;
  if (loading && rows.length === 0) {
    return (
      <div className="cc-grid" aria-busy="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="cc-card" aria-hidden="true">
            <span className="cc-client">
              <span className="cc-skeleton cc-skeleton--circle" />
              <span className="cc-skeleton" style={{ width: 140 }} />
            </span>
            <span className="cc-skeleton" style={{ width: '80%' }} />
            <span className="cc-skeleton" style={{ width: '60%' }} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <>
      <ul
        className="cc-grid"
        aria-label="Clients"
        style={{ listStyle: 'none', margin: 0, padding: 0 }}
      >
        {rows.map((client) => {
          const isSelected = selected.has(client.id);
          return (
            <li
              key={client.id}
              className="cc-card"
              data-selected={isSelected || undefined}
              tabIndex={0}
              aria-label={client.name}
              onClick={() => onOpen(client)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter') onOpen(client);
              }}
            >
              <div className="cc-card-head">
                <input
                  type="checkbox"
                  className="cc-checkbox"
                  aria-label={`Select ${client.name}`}
                  checked={isSelected}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => onToggle(client.id, event.target.checked)}
                />
                <span className="cc-client">
                  <Initials name={client.name} initials={client.initials} />
                  <span className="cc-client-text">
                    <span className="cc-client-name" title={client.name}>
                      {client.name}
                    </span>
                    <span className="cc-client-meta">
                      <span>{client.code}</span>
                      <TypeBadge type={client.client_type} />
                      <SoftwareBadge software={client.accounting_software} />
                    </span>
                    {client.merged_into_client_id ? (
                      <span className="cc-client-meta">
                        <MergedNote clientId={client.merged_into_client_id} />
                      </span>
                    ) : null}
                  </span>
                </span>
                {/* An action runs on its own: the click must not also open the client. */}
                <div onClick={(event) => event.stopPropagation()}>
                  <RowActions
                    label={`Actions for ${client.name}`}
                    items={actionsFor(client)}
                    size="sm"
                  />
                </div>
              </div>
              <dl>
                <dt>Registration</dt>
                <dd>{client.company_number ?? '—'}</dd>
                {segmentsOn ? (
                  <>
                    <dt>Segment</dt>
                    <dd>
                      <SegmentPill segment={client.segment} />
                    </dd>
                  </>
                ) : null}
                {branchesOn ? (
                  <>
                    <dt>Branch</dt>
                    <dd>{client.branch?.name ?? '—'}</dd>
                  </>
                ) : null}
                <dt>Activity</dt>
                <dd>{formatActivity(client.last_activity_at, timeZone)}</dd>
                <dt>Services</dt>
                <dd>
                  <ServicesCell services={client.services} />
                </dd>
              </dl>
            </li>
          );
        })}
      </ul>
      {hasMore ? (
        <div className="cc-load-more" style={{ borderTop: 0 }}>
          <button type="button" className="cc-btn" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}
    </>
  );
}
