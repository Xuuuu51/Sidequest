import { create } from "zustand";

import { createEditorSlice } from "./editor-slice";
import { createNavigationSlice } from "./navigation-slice";
import { createShellPreferencesSlice } from "./shell-preferences-slice";
import type { MainWindowStore } from "./types";
import { createWorkspaceUiSlice } from "./workspace-ui-slice";

export const useMainWindowStore = create<MainWindowStore>()((...args) => ({
  ...createNavigationSlice(...args),
  ...createWorkspaceUiSlice(...args),
  ...createEditorSlice(...args),
  ...createShellPreferencesSlice(...args),
}));
