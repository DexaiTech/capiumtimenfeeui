import { Filter, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

import { Popover } from '@/components/ui';

import { countFilters, EMPTY_FILTERS } from '../constants';
import type { FilterPreset } from '../store';
import type { ClientFilters } from '../types';

export interface FilterSetMenuProps {
  presets: FilterPreset[];
  current: ClientFilters;
  onApply: (filters: ClientFilters) => void;
  onSave: (name: string) => void;
  onDelete: (presetId: string) => void;
}

/** "Filter set": saved filter presets of this browser (save, apply, delete). */
export function FilterSetMenu({ presets, current, onApply, onSave, onDelete }: FilterSetMenuProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const anchorRef = useRef<HTMLButtonElement>(null);
  const canSave = countFilters(current) > 0 && name.trim().length > 0;

  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (!canSave) return;
    onSave(name.trim().slice(0, 60));
    setName('');
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
      >
        <Filter aria-hidden="true" />
        Filter set
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        label="Saved filter sets"
        className="capium-clients cc-popover"
      >
        <p className="cc-popover-title">Saved filter sets</p>
        {presets.length === 0 ? (
          <p className="cc-empty-note">No saved filter sets yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {presets.map((preset) => (
              <li key={preset.id} className="cc-preset-row">
                <button
                  type="button"
                  className="cc-menu-item"
                  onClick={() => {
                    // Sets saved before a filter existed lack it: start from the empty filters.
                    onApply({ ...EMPTY_FILTERS, ...preset.filters });
                    setOpen(false);
                  }}
                >
                  {preset.name}
                  <span className="cc-muted">({countFilters(preset.filters)})</span>
                </button>
                <button
                  type="button"
                  className="cc-btn cc-btn--icon cc-btn--ghost"
                  aria-label={`Delete filter set ${preset.name}`}
                  onClick={() => onDelete(preset.id)}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="cc-menu-sep" />
        <form className="cc-preset-save" onSubmit={submit}>
          <label className="cc-sr-only" htmlFor="cc-preset-name">
            Filter set name
          </label>
          <input
            id="cc-preset-name"
            className="cc-input"
            placeholder={
              countFilters(current) > 0 ? 'Name the current filters' : 'Set some filters first'
            }
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
          />
          <button type="submit" className="cc-btn cc-btn--primary" disabled={!canSave}>
            Save
          </button>
        </form>
      </Popover>
    </>
  );
}
