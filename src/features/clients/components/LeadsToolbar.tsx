import { ChevronDown, Download, Search, UserPlus } from 'lucide-react';
import { useRef, useState, type KeyboardEvent } from 'react';

import { Popover } from '@/components/ui';

import type { LeadStatus } from '../leads/types';
import { ClientsLeadsSwitch } from './ClientsLeadsSwitch';

/** The cap the API puts on the `q` of a lead list; a longer search answers 422. */
const SEARCH_MAX_LENGTH = 100;

export interface LeadsToolbarTab {
  value: LeadStatus;
  label: string;
  /** null while the summary loads: no count is shown. */
  count: number | null;
}

export interface LeadsToolbarColumn {
  id: string;
  label: string;
  /** Locked columns (the lead, its status) are listed but cannot be hidden. */
  locked: boolean;
}

export interface LeadsToolbarProps {
  /** The Clients | Leads switch at the left of row 1: null while a count loads ("–"). */
  clientCount: number | null;
  leadCount: number | null;
  tabs: ReadonlyArray<LeadsToolbarTab>;
  tab: LeadStatus;
  onTabChange: (tab: LeadStatus) => void;
  search: string;
  onSearchChange: (value: string) => void;
  columns: ReadonlyArray<LeadsToolbarColumn>;
  /** Ids of the hidden columns. */
  hidden: ReadonlySet<string>;
  onHiddenChange: (hidden: ReadonlySet<string>) => void;
  /** Export selected is enabled while at least one lead is ticked. */
  canExport: boolean;
  onExport: () => void;
  /** `client.create`: without it there is no Add lead button. */
  canCreate: boolean;
  onAddLead: () => void;
}

/** "Show/Hide Columns ⌄", as on the Client List, over the columns of the lead list. */
function ColumnsMenu({
  columns,
  hidden,
  onChange,
}: Pick<LeadsToolbarProps, 'columns' | 'hidden'> & {
  onChange: (hidden: ReadonlySet<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const toggle = (id: string, visible: boolean) => {
    const next = new Set(hidden);
    if (visible) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="cc-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        style={{ gap: 12 }}
      >
        Show/Hide Columns
        <ChevronDown aria-hidden="true" />
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        label="Visible columns"
        className="capium-clients cc-popover"
      >
        <p className="cc-popover-title">Columns</p>
        {columns.map((column) => (
          <label key={column.id} className="cc-check">
            <input
              type="checkbox"
              className="cc-checkbox"
              checked={!hidden.has(column.id)}
              disabled={column.locked}
              onChange={(event) => toggle(column.id, event.target.checked)}
            />
            {column.label}
          </label>
        ))}
        <div className="cc-menu-sep" />
        <button
          type="button"
          className="cc-menu-item"
          onClick={() => onChange(new Set())}
          disabled={hidden.size === 0}
        >
          Show all columns
        </button>
      </Popover>
    </>
  );
}

/**
 * The toolbar card of the lead list, built like `ClientsToolbar`: row 1 has the Clients | Leads
 * switch, the Open / Converted / Archived tabs and the search; row 2 has Show/Hide Columns,
 * Export selected and the primary Add lead.
 */
export function LeadsToolbar(props: LeadsToolbarProps) {
  const tabsRef = useRef<HTMLDivElement>(null);

  // Arrow keys, Home and End move between the tabs, as in every tab list of the app.
  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const { tabs } = props;
    const index = tabs.findIndex((item) => item.value === props.tab);
    let next: LeadsToolbarTab | undefined;
    if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
    else if (event.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
    else if (event.key === 'Home') next = tabs[0];
    else if (event.key === 'End') next = tabs[tabs.length - 1];
    if (!next) return;
    event.preventDefault();
    props.onTabChange(next.value);
    tabsRef.current?.querySelector<HTMLElement>(`[data-tab="${next.value}"]`)?.focus();
  };

  return (
    <div className="capium-clients cc-toolbar" role="toolbar" aria-label="Leads toolbar">
      <div className="cc-toolbar-group">
        <ClientsLeadsSwitch
          current="leads"
          clientCount={props.clientCount}
          leadCount={props.leadCount}
        />
        <div
          ref={tabsRef}
          className="cc-tabswitch"
          role="tablist"
          aria-label="Lead lists"
          onKeyDown={onTabKeyDown}
        >
          {props.tabs.map((item) => {
            const selected = item.value === props.tab;
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                className="cc-tab"
                data-tab={item.value}
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => props.onTabChange(item.value)}
              >
                {item.label}
                {item.count === null ? null : <span className="cc-count">{item.count}</span>}
              </button>
            );
          })}
        </div>
        <div className="cc-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            placeholder="Search name, contact or email"
            aria-label="Search leads"
            value={props.search}
            maxLength={SEARCH_MAX_LENGTH}
            onChange={(event) => props.onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && props.search) {
                event.stopPropagation();
                props.onSearchChange('');
              }
            }}
          />
        </div>
      </div>

      <div className="cc-toolbar-group">
        <ColumnsMenu
          columns={props.columns}
          hidden={props.hidden}
          onChange={props.onHiddenChange}
        />
        <button
          type="button"
          className="cc-btn cc-btn--outline"
          onClick={props.onExport}
          disabled={!props.canExport}
        >
          <Download aria-hidden="true" />
          Export selected
        </button>
        {props.canCreate ? (
          <button type="button" className="cc-btn cc-btn--primary" onClick={props.onAddLead}>
            <UserPlus aria-hidden="true" />
            Add lead
          </button>
        ) : null}
      </div>
    </div>
  );
}
