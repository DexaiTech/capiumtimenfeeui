import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { guardedStorage } from './store';

/** The clients opened last in a practice, shown on the Client 360 page. */
export const RECENT_CLIENTS_LIMIT = 8;

export const RECENT_CLIENTS_KEY = 'capium-clients-recent';

export interface RecentClient {
  id: string;
  name: string;
  code: string;
}

interface RecentClientsState {
  /** Newest first, per practice id: another practice has other clients. */
  byOrganization: Record<string, RecentClient[]>;
  /** Puts the client first (once), keeping at most `RECENT_CLIENTS_LIMIT`. */
  remember: (organizationId: string, client: RecentClient) => void;
  forget: (organizationId: string, clientId: string) => void;
  clear: (organizationId: string) => void;
}

export const INITIAL_RECENT_CLIENTS = {
  byOrganization: {} as Record<string, RecentClient[]>,
};

const NONE: RecentClient[] = [];

export const useRecentClientsStore = create<RecentClientsState>()(
  persist(
    (set) => ({
      ...INITIAL_RECENT_CLIENTS,
      remember: (organizationId, client) =>
        set((state) => {
          const current = state.byOrganization[organizationId] ?? NONE;
          const first = current[0];
          // Opening the same client again changes nothing: no write, no re-render.
          if (
            first &&
            first.id === client.id &&
            first.name === client.name &&
            first.code === client.code
          ) {
            return state;
          }
          const next = [
            { id: client.id, name: client.name, code: client.code },
            ...current.filter((entry) => entry.id !== client.id),
          ].slice(0, RECENT_CLIENTS_LIMIT);
          return { byOrganization: { ...state.byOrganization, [organizationId]: next } };
        }),
      forget: (organizationId, clientId) =>
        set((state) => ({
          byOrganization: {
            ...state.byOrganization,
            [organizationId]: (state.byOrganization[organizationId] ?? NONE).filter(
              (entry) => entry.id !== clientId,
            ),
          },
        })),
      clear: (organizationId) =>
        set((state) => ({
          byOrganization: { ...state.byOrganization, [organizationId]: [] },
        })),
    }),
    {
      name: RECENT_CLIENTS_KEY,
      version: 1,
      storage: createJSONStorage(() => guardedStorage),
      partialize: (state) => ({ byOrganization: state.byOrganization }),
    },
  ),
);

/** The recently viewed clients of a practice, newest first. */
export function useRecentClients(organizationId: string): RecentClient[] {
  return useRecentClientsStore((state) => state.byOrganization[organizationId] ?? NONE);
}
