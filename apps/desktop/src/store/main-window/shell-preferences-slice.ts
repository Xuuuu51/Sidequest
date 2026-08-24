import type { StateCreator } from "zustand";

import type { MainWindowStore, ShellPreferencesSlice } from "./types";

export const DEFAULT_PANEL_PREFERENCES = {
  sidebarWidth: 224,
  sidebarCollapsed: false,
  drawerWidth: 480,
} as const;

export const createShellPreferencesSlice: StateCreator<
  MainWindowStore,
  [],
  [],
  ShellPreferencesSlice
> = (set) => ({
  ...DEFAULT_PANEL_PREFERENCES,
  preferencesHydrated: false,
  setSidebarWidth: (sidebarWidth) =>
    set({ sidebarWidth: clamp(sidebarWidth, 180, 320) }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setDrawerWidth: (drawerWidth) =>
    set({ drawerWidth: clamp(drawerWidth, 420, 560) }),
});

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}
