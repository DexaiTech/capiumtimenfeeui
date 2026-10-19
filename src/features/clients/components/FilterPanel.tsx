import { Funnel, ListFilter } from 'lucide-react';
import { useRef, useState } from 'react';

import { Popover } from '@/components/ui';

import {
  AML_OPTIONS,
  CENTRAL_FILTER_OPTIONS,
  CLIENT_STATUS_OPTIONS,
  CLIENT_TYPE_OPTIONS,
  countFilters,
  EMPTY_FILTERS,
  KNOWN_SEGMENTS,
  parseCentralFilter,
  SOFTWARE_OPTIONS,
} from '../constants';
import type { ClientFilters, MemberRead, SegmentCount, ServiceRead } from '../types';

export interface FilterPanelProps {
  filters: ClientFilters;
  onChange: (filters: ClientFilters) => void;
  segments: SegmentCount[];
  services: ServiceRead[];
  members: MemberRead[];
  /** False without `member.read`: the manager and partner pickers are left out. */
  canPickPeople: boolean;
}

type ListKey = 'status' | 'segment' | 'client_type' | 'aml_status' | 'accounting_software';

function toggle<T extends string>(values: readonly T[], value: T, on: boolean): T[] {
  return on ? Array.from(new Set([...values, value])) : values.filter((item) => item !== value);
}

interface CheckGroupProps {
  legend: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  values: readonly string[];
  onToggle: (value: string, on: boolean) => void;
}

function CheckGroup({ legend, options, values, onToggle }: CheckGroupProps) {
  return (
    <fieldset className="cc-fieldset">
      <legend>{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className="cc-check">
          <input
            type="checkbox"
            className="cc-checkbox"
            checked={values.includes(option.value)}
            onChange={(event) => onToggle(option.value, event.target.checked)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}

/** "Filter": status, segment, client type, AML, software, service, manager and partner. */
export function FilterPanel({
  filters,
  onChange,
  segments,
  services,
  members,
  canPickPeople,
}: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const count = countFilters(filters);

  const setList = (key: ListKey, value: string, on: boolean) =>
    onChange({ ...filters, [key]: toggle(filters[key] as string[], value, on) });

  // Known segments first, then whatever else the practice uses.
  const segmentNames = Array.from(
    new Set([
      ...KNOWN_SEGMENTS,
      ...segments.map((entry) => entry.segment).filter((name): name is string => Boolean(name)),
    ]),
  );

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="cc-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <Funnel aria-hidden="true" />
        Filter
        {count > 0 ? (
          <span className="cc-btn-badge">
            <span aria-hidden="true">{count}</span>
            <span className="cc-sr-only"> {count} filters applied</span>
          </span>
        ) : null}
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        label="Filter clients"
        align="end"
        className="capium-clients cc-popover"
      >
        <div className="cc-filter-panel">
          <div className="cc-filter-grid">
            <CheckGroup
              legend="Status"
              options={CLIENT_STATUS_OPTIONS}
              values={filters.status}
              onToggle={(value, on) => setList('status', value, on)}
            />
            <CheckGroup
              legend="Segment"
              options={segmentNames.map((name) => ({ value: name, label: name }))}
              values={filters.segment}
              onToggle={(value, on) => setList('segment', value, on)}
            />
            <CheckGroup
              legend="Client type"
              options={CLIENT_TYPE_OPTIONS}
              values={filters.client_type}
              onToggle={(value, on) => setList('client_type', value, on)}
            />
            <CheckGroup
              legend="AML status"
              options={AML_OPTIONS}
              values={filters.aml_status}
              onToggle={(value, on) => setList('aml_status', value, on)}
            />
            <CheckGroup
              legend="Accounting software"
              options={SOFTWARE_OPTIONS}
              values={filters.accounting_software}
              onToggle={(value, on) => setList('accounting_software', value, on)}
            />
            <div className="cc-fieldset">
              <label className="cc-label" htmlFor="cc-filter-service">
                Service
              </label>
              <select
                id="cc-filter-service"
                className="cc-select"
                value={filters.service_id ?? ''}
                onChange={(event) =>
                  onChange({ ...filters, service_id: event.target.value || null })
                }
              >
                <option value="">Any service</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
              <label className="cc-label" htmlFor="cc-filter-central" style={{ marginTop: 8 }}>
                Central
              </label>
              <select
                id="cc-filter-central"
                className="cc-select"
                value={filters.central ?? ''}
                onChange={(event) =>
                  onChange({ ...filters, central: parseCentralFilter(event.target.value) })
                }
              >
                <option value="">Any</option>
                {CENTRAL_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {canPickPeople ? (
                <>
                  <label className="cc-label" htmlFor="cc-filter-manager" style={{ marginTop: 8 }}>
                    Manager
                  </label>
                  <select
                    id="cc-filter-manager"
                    className="cc-select"
                    value={filters.manager_user_id ?? ''}
                    onChange={(event) =>
                      onChange({ ...filters, manager_user_id: event.target.value || null })
                    }
                  >
                    <option value="">Anyone</option>
                    {members.map((member) => (
                      <option key={member.user_id} value={member.user_id}>
                        {member.full_name}
                      </option>
                    ))}
                  </select>
                  <label className="cc-label" htmlFor="cc-filter-partner" style={{ marginTop: 8 }}>
                    Partner
                  </label>
                  <select
                    id="cc-filter-partner"
                    className="cc-select"
                    value={filters.partner_user_id ?? ''}
                    onChange={(event) =>
                      onChange({ ...filters, partner_user_id: event.target.value || null })
                    }
                  >
                    <option value="">Anyone</option>
                    {members.map((member) => (
                      <option key={member.user_id} value={member.user_id}>
                        {member.full_name}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}
            </div>
          </div>
          <div className="cc-panel-footer">
            <button
              type="button"
              className="cc-btn"
              onClick={() => onChange(EMPTY_FILTERS)}
              disabled={count === 0}
            >
              <ListFilter aria-hidden="true" />
              Clear filters
            </button>
            <button type="button" className="cc-btn cc-btn--primary" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      </Popover>
    </>
  );
}
