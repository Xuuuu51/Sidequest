import { beforeEach, describe, expect, it } from "vitest";

import type { AppStateDto } from "../shared/tauri/types";
import {
  currentPanelPreferences,
  laneScrollKey,
  useMainWindowStore,
} from "./main-window";

const appState: AppStateDto = {
  projects: [
    { path: "/first", name: "first", state: "writable" },
    { path: "/second", name: "second", state: "readOnly" },
  ],
  lastSelectedProject: "/second",
  panelPreferences: {
    sidebarWidth: 224,
    sidebarCollapsed: false,
    drawerWidth: 480,
  },
  recoveryWarning: null,
};

describe("useMainWindowStore", () => {
  beforeEach(() => {
    useMainWindowStore.setState({
      route: "restoring",
      selectedProjectPath: null,
      searchQuery: "",
      selectedQuestId: null,
      drawerOpen: false,
      sidebarWidth: 224,
      sidebarCollapsed: false,
      drawerWidth: 480,
      preferencesHydrated: false,
      laneScrollPositions: {},
      issuesExpanded: false,
      projectMenuPath: null,
      recoveryDismissed: false,
      toast: null,
      editor: null,
      drag: null,
      statusMenuOpen: false,
      deleteConfirming: false,
      deleteError: null,
      navigationPending: false,
      navigationIntent: null,
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
      panelPreferences: appState.panelPreferences,
      recoveryWarning: null,
    });

    expect(useMainWindowStore.getState().route).toBe("onboarding");
    expect(useMainWindowStore.getState().selectedProjectPath).toBeNull();
  });

  it("clears_project_specific_presentation_when_switching_projects", () => {
    const store = useMainWindowStore.getState();
    store.synchronizeAppState(appState);
    store.setSearchQuery("query");
    store.selectQuest("sq_selected");

    store.selectProject("/first");

    const state = useMainWindowStore.getState();
    expect(state.selectedProjectPath).toBe("/first");
    expect(state.searchQuery).toBe("");
    expect(state.selectedQuestId).toBeNull();
    expect(state.drawerOpen).toBe(false);
  });

  it("closes_the_drawer_without_clearing_selection", () => {
    const store = useMainWindowStore.getState();
    store.selectQuest("sq_selected");
    store.closeDrawer();

    expect(useMainWindowStore.getState().selectedQuestId).toBe("sq_selected");
    expect(useMainWindowStore.getState().drawerOpen).toBe(false);

    useMainWindowStore.getState().openSelectedQuest();
    expect(useMainWindowStore.getState().drawerOpen).toBe(true);
  });

  it("clamps_panels_and_keeps_lane_scroll_positions_per_project", () => {
    const store = useMainWindowStore.getState();
    store.setSidebarWidth(999);
    store.setDrawerWidth(20);
    store.setSidebarCollapsed(true);
    store.setLaneScrollPosition("/first", "inbox", 120);
    store.setLaneScrollPosition("/second", "inbox", 360);

    const state = useMainWindowStore.getState();
    expect(currentPanelPreferences(state)).toEqual({
      sidebarWidth: 320,
      sidebarCollapsed: true,
      drawerWidth: 420,
    });
    expect(state.laneScrollPositions[laneScrollKey("/first", "inbox")]).toBe(
      120,
    );
    expect(state.laneScrollPositions[laneScrollKey("/second", "inbox")]).toBe(
      360,
    );
  });

  it("keeps_newer_draft_content_when_an_older_save_completes", () => {
    const store = useMainWindowStore.getState();
    store.initializeEditor(
      "/first",
      "sq_quest",
      "Original",
      "2026-08-23T10:00:00Z",
      "inbox",
    );
    store.startEditing();
    store.changeDraft("First edit");
    store.beginSaving();
    store.changeDraft("Newest edit");

    store.completeSaving("First edit");

    const editor = useMainWindowStore.getState().editor;
    expect(editor?.baseContent).toBe("First edit");
    expect(editor?.draftContent).toBe("Newest edit");
    expect(editor?.phase).toBe("pending");
  });

  it("records_external_conflicts_without_copying_workspace_data", () => {
    const store = useMainWindowStore.getState();
    store.initializeEditor(
      "/first",
      "sq_quest",
      "Disk",
      "2026-08-23T10:00:00Z",
      "inbox",
    );
    store.startEditing();
    store.changeDraft("Local draft");
    store.setExternalConflict("modified");

    expect(useMainWindowStore.getState().editor).toMatchObject({
      draftContent: "Local draft",
      phase: "externalConflict",
      conflict: "modified",
    });
    expect(useMainWindowStore.getState()).not.toHaveProperty("quests");
  });
});
