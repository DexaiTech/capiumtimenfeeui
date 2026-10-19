import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import type { ToggleableColumnId } from './constants';
import type { ClientFilters } from './types';

export type ClientsView = 'list' | 'grid';

export interface FilterPreset {
  id: string;
  name: string;
  filters: ClientFilters;
}

interface ClientsPrefsState {
  /** Hidden table columns. A preference of this browser, not server data. */
  hiddenColumns: ToggleableColumnId[];
  view: ClientsView;
  /** Saved filter sets per practice id (filters name practice-specific ids). */
  presets: Record<string, FilterPreset[]>;
  setColumnHidden: (column: ToggleableColumnId, hidden: boolean) => void;
  showAllColumns: () => void;
  setView: (view: ClientsView) => void;
  savePreset: (organizationId: string, name: string, filters: ClientFilters) => void;
  deletePreset: (organizationId: string, presetId: string) => void;
}

/**
 * Web storage that never throws: private windows, blocked site data and full quotas just
 * mean the preference is not remembered.
 */
export const guardedStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // Not remembered; the page works without it.
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      // Nothing to do.
    }
  },
};

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export const CLIENTS_PREFS_KEY = 'capium-clients';

export const INITIAL_CLIENTS_PREFS = {
  hiddenColumns: [] as ToggleableColumnId[],
  view: 'list' as ClientsView,
  presets: {} as Record<string, FilterPreset[]>,
};

export const useClientsPrefs = create<ClientsPrefsState>()(
  persist(
    (set) => ({
      ...INITIAL_CLIENTS_PREFS,
      setColumnHidden: (column, hidden) =>
        set((state) => ({
          hiddenColumns: hidden
            ? Array.from(new Set([...state.hiddenColumns, column]))
            : state.hiddenColumns.filter((id) => id !== column),
        })),
      showAllColumns: () => set({ hiddenColumns: [] }),
      setView: (view) => set({ view }),
      savePreset: (organizationId, name, filters) =>
        set((state) => {
          const existing = state.presets[organizationId] ?? [];
          // Saving under an existing name replaces that set.
          const others = existing.filter(
            (preset) => preset.name.toLowerCase() !== name.toLowerCase(),
          );
          return {
            presets: {
              ...state.presets,
              [organizationId]: [...others, { id: newId(), name, filters }],
            },
          };
        }),
      deletePreset: (organizationId, presetId) =>
        set((state) => ({
          presets: {
            ...state.presets,
            [organizationId]: (state.presets[organizationId] ?? []).filter(
              (preset) => preset.id !== presetId,
            ),
          },
        })),
    }),
    {
      name: CLIENTS_PREFS_KEY,
      version: 1,
      storage: createJSONStorage(() => guardedStorage),
      partialize: (state) => ({
        hiddenColumns: state.hiddenColumns,
        view: state.view,
        presets: state.presets,
      }),
    },
  ),
);
