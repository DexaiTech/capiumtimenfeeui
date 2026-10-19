import {
  Building2,
  FileDown,
  FilePenLine,
  FileUp,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  UserPlus,
  Users,
  UsersRound,
} from 'lucide-react';
import type { KeyboardEvent } from 'react';

import type { ToggleableColumnId } from '../constants';
import type { ClientsView, FilterPreset } from '../store';
import type { ClientFilters, ClientSummary, MemberRead, ServiceRead } from '../types';
import { AnalyticsPanel } from './AnalyticsPanel';
import { BulkActionsMenu } from './BulkActionsMenu';
import { ColumnsMenu } from './ColumnsMenu';
import { FilterPanel } from './FilterPanel';
import { FilterSetMenu } from './FilterSetMenu';

export type ClientsTab = 'clients' | 'users';

export interface ClientsToolbarProps {
  tab: ClientsTab;
  onTabChange: (tab: ClientsTab) => void;
  clientCount: number | undefined;
  userCount: number | undefined;
  search: string;
  onSearchChange: (value: string) => void;
  hidden: ReadonlySet<ToggleableColumnId>;
  onColumnChange: (column: ToggleableColumnId, hidden: boolean) => void;
  onShowAllColumns: () => void;
  filters: ClientFilters;
  onFiltersChange: (filters: ClientFilters) => void;
  presets: FilterPreset[];
  onSavePreset: (name: string) => void;
  onDeletePreset: (presetId: string) => void;
  summary: ClientSummary | undefined;
  summaryLoading: boolean;
  services: ServiceRead[];
  members: MemberRead[];
  canPickPeople: boolean;
  selectedCount: number;
  canArchive: boolean;
  onBulkArchive: () => void;
  onBulkExport: () => void;
  draftsActive: boolean;
  onToggleDrafts: () => void;
  view: ClientsView;
  onViewChange: (view: ClientsView) => void;
  canCreate: boolean;
  onImport: () => void;
  onExport: () => void;
  exporting: boolean;
  onAddClient: () => void;
  /** `client.create`: search the central client service and enable its clients. */
  canEnableCentral: boolean;
  onCentralClients: () => void;
  /** `client.update`: synchronise every linked client. */
  canSyncAll: boolean;
  onSyncAll: () => void;
  syncingAll: boolean;
  /** How many clients are linked (the summary); the action needs at least one. */
  linkedCount: number | undefined;
}

/** The toolbar card: count tabs and quick search on the left, the actions on the right. */
export function ClientsToolbar(props: ClientsToolbarProps) {
  const { tab, onTabChange } = props;
  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = tab === 'clients' ? 'users' : 'clients';
      onTabChange(next);
      event.currentTarget.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus();
    }
  };
  const clientsTab = tab === 'clients';

  return (
    <div className="cc-toolbar" role="toolbar" aria-label="Clients toolbar">
      <div className="cc-toolbar-group">
        <div
          className="cc-tabswitch"
          role="tablist"
          aria-label="Clients or users"
          onKeyDown={onTabKeyDown}
        >
          <button
            type="button"
            role="tab"
            data-tab="clients"
            className="cc-tab"
            aria-selected={clientsTab}
            tabIndex={clientsTab ? 0 : -1}
            onClick={() => onTabChange('clients')}
          >
            <Users aria-hidden="true" />
            Clients
            <span className="cc-count">{props.clientCount ?? '–'}</span>
          </button>
          <button
            type="button"
            role="tab"
            data-tab="users"
            className="cc-tab"
            aria-selected={!clientsTab}
            tabIndex={clientsTab ? -1 : 0}
            onClick={() => onTabChange('users')}
          >
            <UsersRound aria-hidden="true" />
            Users
            <span className="cc-count">{props.userCount ?? '–'}</span>
          </button>
        </div>
        <div className="cc-search">
          <Search aria-hidden="true" />
          <input
            id="cc-quick-search"
            type="search"
            placeholder="Quick search"
            aria-label={clientsTab ? 'Quick search clients' : 'Quick search users'}
            value={props.search}
            maxLength={200}
            onChange={(event) => props.onSearchChange(event.target.value)}
          />
        </div>
      </div>

      {clientsTab ? (
        <div className="cc-toolbar-group">
          <ColumnsMenu
            hidden={props.hidden}
            onChange={props.onColumnChange}
            onShowAll={props.onShowAllColumns}
          />
          <FilterSetMenu
            presets={props.presets}
            current={props.filters}
            onApply={props.onFiltersChange}
            onSave={props.onSavePreset}
            onDelete={props.onDeletePreset}
          />
          <FilterPanel
            filters={props.filters}
            onChange={props.onFiltersChange}
            segments={props.summary?.by_segment ?? []}
            services={props.services}
            members={props.members}
            canPickPeople={props.canPickPeople}
          />
          <AnalyticsPanel summary={props.summary} loading={props.summaryLoading} />
          <BulkActionsMenu
            count={props.selectedCount}
            canArchive={props.canArchive}
            onArchive={props.onBulkArchive}
            onExport={props.onBulkExport}
          />
          <button
            type="button"
            className="cc-btn"
            aria-pressed={props.draftsActive}
            onClick={props.onToggleDrafts}
            title="Draft clients (prospects)"
          >
            <FilePenLine aria-hidden="true" />
            Drafts
          </button>
          <div className="cc-viewtoggle" role="group" aria-label="Layout">
            <button
              type="button"
              aria-label="List view"
              aria-pressed={props.view === 'list'}
              onClick={() => props.onViewChange('list')}
            >
              <List aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Grid view"
              aria-pressed={props.view === 'grid'}
              onClick={() => props.onViewChange('grid')}
            >
              <LayoutGrid aria-hidden="true" />
            </button>
          </div>
          {props.canEnableCentral ? (
            <button type="button" className="cc-btn" onClick={props.onCentralClients}>
              <Building2 aria-hidden="true" />
              Central clients
            </button>
          ) : null}
          {props.canSyncAll ? (
            <button
              type="button"
              className="cc-btn"
              onClick={props.onSyncAll}
              disabled={props.syncingAll || !props.linkedCount}
              aria-busy={props.syncingAll || undefined}
              title={props.linkedCount ? undefined : 'No client is linked to the central service'}
            >
              <RefreshCw aria-hidden="true" />
              {props.syncingAll ? 'Syncing…' : 'Sync all linked'}
            </button>
          ) : null}
          {props.canCreate ? (
            <button type="button" className="cc-btn cc-btn--outline" onClick={props.onImport}>
              <FileDown aria-hidden="true" />
              Import
            </button>
          ) : null}
          <button
            type="button"
            className="cc-btn cc-btn--outline"
            onClick={props.onExport}
            disabled={props.exporting}
            aria-busy={props.exporting || undefined}
          >
            <FileUp aria-hidden="true" />
            {props.exporting ? 'Exporting…' : 'Export'}
          </button>
          {props.canCreate ? (
            <button type="button" className="cc-btn cc-btn--primary" onClick={props.onAddClient}>
              <UserPlus aria-hidden="true" />
              Add Client
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
