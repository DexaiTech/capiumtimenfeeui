import { create } from 'zustand';

const COLLAPSED_KEY = 'capium.sidebar.collapsed';

/** The sidebar's last state; a browser without storage (or a blocked one) starts it open. */
function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function saveCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // Not kept: the sidebar still works for this visit.
  }
}

interface ShellState {
  /** Navigation drawer below the lg breakpoint. */
  drawerOpen: boolean;
  /** The search dialog of the top bar. */
  searchOpen: boolean;
  /** The left sidebar from lg up: icons only when true. Remembered between visits. */
  sidebarCollapsed: boolean;
  setDrawerOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

/** Chrome state. Only the sidebar's width is remembered; the rest is transient. */
export const useShellStore = create<ShellState>()((set) => ({
  drawerOpen: false,
  searchOpen: false,
  sidebarCollapsed: readCollapsed(),
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setSidebarCollapsed: (sidebarCollapsed) => {
    saveCollapsed(sidebarCollapsed);
    set({ sidebarCollapsed });
  },
}));
