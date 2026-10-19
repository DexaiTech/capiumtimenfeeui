import { create } from 'zustand';

interface ShellState {
  /** Navigation drawer below the lg breakpoint. */
  drawerOpen: boolean;
  /** The search dialog of the top bar. */
  searchOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
}

/** Transient chrome state; nothing here is persisted. */
export const useShellStore = create<ShellState>()((set) => ({
  drawerOpen: false,
  searchOpen: false,
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
}));
