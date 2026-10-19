import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface ReturnPathState {
  /**
   * A page to come back to after a detour that loses the `?next=` parameter
   * (registration and email verification on the way to an invitation).
   */
  returnPath: string | null;
  setReturnPath: (path: string | null) => void;
}

/** Kept in sessionStorage: it belongs to this tab's flow and disappears with the tab. */
export const useReturnPathStore = create<ReturnPathState>()(
  persist(
    (set) => ({
      returnPath: null,
      setReturnPath: (returnPath) => set({ returnPath }),
    }),
    {
      name: 'capium-return-path',
      version: 1,
      storage: createJSONStorage(() => window.sessionStorage),
    },
  ),
);
