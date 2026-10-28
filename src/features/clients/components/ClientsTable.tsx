import { Plus } from 'lucide-react';
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';

import { RowActions } from '@/components/ui';
import { formatActivity, initialsOf } from '../format';
import type { ToggleableColumnId } from '../constants';
import type { ClientListItem, ClientSort, SortOrder } from '../types';
import { type MenuAction } from './ActionMenu';
import {
  CentralCell,
  DeadlineCell,
  HealthCell,
  Initials,
  MergedNote,
  SegmentPill,
  ServicesCell,
  SoftwareBadge,
  TypeBadge,
} from './ClientCells';

export interface ClientsTableProps {
  rows: ClientListItem[];
  hidden: ReadonlySet<ToggleableColumnId>;
  sort: ClientSort;
  order: SortOrder;
  onSort: (sort: ClientSort) => void;
  selected: ReadonlySet<string>;
  onToggle: (clientId: string, checked: boolean) => void;
  onTogglePage: (checked: boolean) => void;
  onOpen: (client: ClientListItem) => void;
  /** Null when the caller may not add contacts: the cell then shows a dash. */
  onAddContact: ((client: ClientListItem) => void) | null;
  actionsFor: (client: ClientListItem) => MenuAction[];
  timeZone: string;
  today: string;
  /** First page loading: skeleton rows. */
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  /** Shown instead of the rows (empty and error states). */
  placeholder?: ReactNode;
}

interface SortHeaderProps {
  label: string;
  className: string;
  sortKey: ClientSort;
  sort: ClientSort;
  order: SortOrder;
  onSort: (sort: ClientSort) => void;
}

function SortHeader({ label, className, sortKey, sort, order, onSort }: SortHeaderProps) {
  const active = sort === sortKey;
  const direction = order === 'asc' ? 'ascending' : 'descending';
  return (
    <th scope="col" className={className} aria-sort={active ? direction : 'none'}>
      <button
        type="button"
        className="cc-sort"
        data-dir={active ? order : undefined}
        onClick={() => onSort(sortKey)}
      >
        {label}
        <span className="cc-sort-icon" aria-hidden="true">
          <span />
          <span />
        </span>
      </button>
    </th>
  );
}

const SKELETON_ROWS = 8;

/** The client list as a real `<table>` (docs/design/clients-page.md, "Table card"). */
export function ClientsTable({
  rows,
  hidden,
  sort,
  order,
  onSort,
  selected,
  onToggle,
  onTogglePage,
  onOpen,
  onAddContact,
  actionsFor,
  timeZone,
  today,
  loading,
  hasMore,
  loadingMore,
  onLoadMore,
  placeholder,
}: ClientsTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const headerCheckRef = useRef<HTMLInputElement>(null);
  const show = (column: ToggleableColumnId) => !hidden.has(column);

  const pageIds = rows.map((row) => row.id);
  const selectedOnPage = pageIds.filter((id) => selected.has(id)).length;
  const allSelected = pageIds.length > 0 && selectedOnPage === pageIds.length;

  useEffect(() => {
    if (headerCheckRef.current) {
      headerCheckRef.current.indeterminate = selectedOnPage > 0 && !allSelected;
    }
  }, [selectedOnPage, allSelected]);

  // Infinite scroll where the browser supports it; the "Load more" button always works.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !loadingMore) onLoadMore();
      },
      { root: scrollRef.current, rootMargin: '120px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  const visibleCount = 2 + TOGGLE_ORDER.filter(show).length;

  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, client: ClientListItem) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(client);
    }
  };

  return (
    <div className="cc-table-card">
      <div className="cc-table-scroll" ref={scrollRef}>
        <table className="cc-table">
          <caption className="cc-sr-only">Clients</caption>
          <thead>
            <tr>
              <th scope="col" className="cc-col-check">
                <input
                  ref={headerCheckRef}
                  type="checkbox"
                  className="cc-checkbox"
                  aria-label="Select all clients on this page"
                  checked={allSelected}
                  disabled={rows.length === 0}
                  onChange={(event) => onTogglePage(event.target.checked)}
                />
              </th>
              <SortHeader
                label="Client"
                className="cc-col-client"
                sortKey="name"
                sort={sort}
                order={order}
                onSort={onSort}
              />
              {show('reg_no') ? (
                <th scope="col" className="cc-col-reg_no">
                  Reg No
                </th>
              ) : null}
              {show('segment') ? (
                <SortHeader
                  label="Segment"
                  className="cc-col-segment"
                  sortKey="segment"
                  sort={sort}
                  order={order}
                  onSort={onSort}
                />
              ) : null}
              {show('health') ? (
                <SortHeader
                  label="Health"
                  className="cc-col-health"
                  sortKey="health_score"
                  sort={sort}
                  order={order}
                  onSort={onSort}
                />
              ) : null}
              {show('contact') ? (
                <th scope="col" className="cc-col-contact">
                  Contact
                </th>
              ) : null}
              {/* The API has no contact-email sort key, so this header is not sortable. */}
              {show('contact_email') ? (
                <th scope="col" className="cc-col-contact_email">
                  Contact Email
                </th>
              ) : null}
              {show('deadlines') ? (
                <th scope="col" className="cc-col-deadlines">
                  Deadlines
                </th>
              ) : null}
              {show('activity') ? (
                <th scope="col" className="cc-col-activity">
                  Activity
                </th>
              ) : null}
              {show('services') ? (
                <th scope="col" className="cc-col-services">
                  Services
                </th>
              ) : null}
              {show('central') ? (
                <th scope="col" className="cc-col-central">
                  Central
                </th>
              ) : null}
              {show('action') ? (
                <th scope="col" className="cc-col-action">
                  Action
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {placeholder ? (
              <tr className="cc-row--static">
                <td colSpan={visibleCount}>{placeholder}</td>
              </tr>
            ) : loading && rows.length === 0 ? (
              Array.from({ length: SKELETON_ROWS }, (_, index) => (
                <tr
                  key={index}
                  className="cc-row--static"
                  aria-hidden="true"
                  data-testid="skeleton-row"
                >
                  <td>
                    <span className="cc-skeleton" style={{ width: 14 }} />
                  </td>
                  <td>
                    <span className="cc-client">
                      <span className="cc-skeleton cc-skeleton--circle" />
                      <span className="cc-skeleton" style={{ width: 120 }} />
                    </span>
                  </td>
                  {TOGGLE_ORDER.filter(show).map((column) => (
                    <td key={column}>
                      <span className="cc-skeleton" style={{ width: 60 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              rows.map((client) => {
                const isSelected = selected.has(client.id);
                return (
                  <tr
                    key={client.id}
                    data-selected={isSelected || undefined}
                    tabIndex={0}
                    aria-label={client.name}
                    onClick={() => onOpen(client)}
                    onKeyDown={(event) => onRowKeyDown(event, client)}
                  >
                    <td onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="cc-checkbox"
                        aria-label={`Select ${client.name}`}
                        checked={isSelected}
                        onChange={(event) => onToggle(client.id, event.target.checked)}
                        onKeyDown={(event) => event.stopPropagation()}
                      />
                    </td>
                    <td>
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
                    </td>
                    {show('reg_no') ? <td>{client.company_number ?? ''}</td> : null}
                    {show('segment') ? (
                      <td>
                        <SegmentPill segment={client.segment} />
                      </td>
                    ) : null}
                    {show('health') ? (
                      <td>
                        <HealthCell score={client.health_score} />
                      </td>
                    ) : null}
                    {show('contact') ? (
                      <td>
                        <ContactCell client={client} onAddContact={onAddContact} />
                      </td>
                    ) : null}
                    {show('contact_email') ? <td>{client.contact_email ?? ''}</td> : null}
                    {show('deadlines') ? (
                      <td>
                        <DeadlineCell deadlines={client.deadlines} today={today} />
                      </td>
                    ) : null}
                    {show('activity') ? (
                      <td>{formatActivity(client.last_activity_at, timeZone)}</td>
                    ) : null}
                    {show('services') ? (
                      <td>
                        <ServicesCell services={client.services} />
                      </td>
                    ) : null}
                    {show('central') ? (
                      <td>
                        <CentralCell client={client} timeZone={timeZone} />
                      </td>
                    ) : null}
                    {show('action') ? (
                      <td>
                        <RowActions
                          label={`Actions for ${client.name}`}
                          items={actionsFor(client)}
                          size="sm"
                        />
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
      </div>
      {hasMore && !placeholder ? (
        <div className="cc-load-more">
          <button type="button" className="cc-btn" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** The toggleable columns in table order. */
const TOGGLE_ORDER: ToggleableColumnId[] = [
  'reg_no',
  'segment',
  'health',
  'contact',
  'contact_email',
  'deadlines',
  'activity',
  'services',
  'central',
  'action',
];

function ContactCell({
  client,
  onAddContact,
}: {
  client: ClientListItem;
  onAddContact: ((client: ClientListItem) => void) | null;
}) {
  const name = client.contact_name ?? client.primary_contact?.name ?? null;
  if (name) {
    return (
      <span className="cc-contact" title={name}>
        <Initials name={name} initials={initialsOf(name)} size="sm" />
        <span>{name}</span>
      </span>
    );
  }
  if (!onAddContact) return <span className="cc-muted">—</span>;
  return (
    <button
      type="button"
      className="cc-add-pill"
      aria-label={`Add contact for ${client.name}`}
      onClick={(event) => {
        event.stopPropagation();
        onAddContact(client);
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Plus aria-hidden="true" />
      Add
    </button>
  );
}
