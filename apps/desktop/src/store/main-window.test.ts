import { beforeEach, describe, expect, it } from "vitest";

import type { AppStateDto } from "../shared/tauri/types";
import { useMainWindowStore } from "./main-window";

const appState: AppStateDto = {
  projects: [
    { path: "/first", name: "first", state: "writable" },
    { path: "/second", name: "second", state: "readOnly" },
  ],
  lastSelectedProject: "/second",
  recoveryWarning: null,
};

describe("useMainWindowStore", () => {
  beforeEach(() => {
    useMainWindowStore.setState({
      route: "restoring",
      selectedProjectPath: null,
    });
  });

  it("stores_only_route_and_selected_project_workflow_data", () => {
    useMainWindowStore.getState().synchronizeAppState(appState);

    const state = useMainWindowStore.getState();
    expect(state.route).toBe("workspace");
    expect(state.selectedProjectPath).toBe("/second");
    expect(state).not.toHaveProperty("projects");
    expect(state).not.toHaveProperty("quests");
  });

  it("returns_to_onboarding_after_the_last_project_is_removed", () => {
    useMainWindowStore.getState().synchronizeAppState(appState);
    useMainWindowStore.getState().synchronizeAppState({
      projects: [],
      lastSelectedProject: null,
      recoveryWarning: null,
    });

    expect(useMainWindowStore.getState().route).toBe("onboarding");
    expect(useMainWindowStore.getState().selectedProjectPath).toBeNull();
  });
});
