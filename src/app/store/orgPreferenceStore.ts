import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OrgPreferenceState {
  /** Slug of the organization the user opened last. A preference, not a secret and not server data. */
  lastOrgSlug: string | null;
  setLastOrgSlug: (slug: string | null) => void;
}

/** Remembers which organization `/app` should open. Checked against the user's memberships before use. */
export const useOrgPreferenceStore = create<OrgPreferenceState>()(
  persist(
    (set) => ({
      lastOrgSlug: null,
      setLastOrgSlug: (lastOrgSlug) => set({ lastOrgSlug }),
    }),
    { name: 'capium-org', version: 1 },
  ),
);
