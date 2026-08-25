import { QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MainWindowApp as App } from "./app/main-window-app";
import { createDesktopQueryClient } from "./shared/query/client";
import type { AppStateDto, WorkspaceSnapshotDto } from "./shared/tauri/types";
import { useMainWindowStore } from "./store/main-window/store";
import { Toaster } from "./shared/ui/sonner";

const mocks = vi.hoisted(() => ({
  getAppState: vi.fn(),
  addProject: vi.fn(),
  removeProject: vi.fn(),
  setLastSelectedProject: vi.fn(),
  loadWorkspace: vi.fn(),
  searchQuests: vi.fn(),
  setWatchedProject: vi.fn(),
  relocateProject: vi.fn(),
  setPanelPreferences: vi.fn(),
  saveMainWindowGeometry: vi.fn(),
  revealPath: vi.fn(),
  selectProjectDirectory: vi.fn(),
  selectReplacementDirectory: vi.fn(),
  listenForWorkspaceInvalidation: vi.fn(),
  listenForAppStateInvalidation: vi.fn(),
  listenForSettingsInvalidation: vi.fn(),
  listenForIntegrationsInvalidation: vi.fn(),
  listenForOpenSettings: vi.fn(),
  listenForDebugReloadRequest: vi.fn(),
  updateQuestContent: vi.fn(),
  setQuestStatus: vi.fn(),
  deleteQuest: vi.fn(),
  getSettings: vi.fn(),
  getLocaleSettings: vi.fn(),
  getThemeSettings: vi.fn(),
  getIntegrationStatus: vi.fn(),
  setGlobalShortcut: vi.fn(),
  setLaunchAtLogin: vi.fn(),
  setOnboardingStep: vi.fn(),
  setLocalePreference: vi.fn(),
  setThemePreference: vi.fn(),
  installCli: vi.fn(),
  uninstallCli: vi.fn(),
  installAgentSkill: vi.fn(),
  uninstallAgentSkill: vi.fn(),
  copyDiagnosticReport: vi.fn(),
  revealDiagnosticLogs: vi.fn(),
  workspaceInvalidatedHandler: null as
    ((payload: { projectPath: string }) => void) | null,
}));

vi.mock("./shared/tauri/commands", () => ({
  ...mocks,
  createQuest: vi.fn(),
}));

vi.mock("./shared/tauri/events", () => ({
  listenForWorkspaceInvalidation: mocks.listenForWorkspaceInvalidation,
  listenForAppStateInvalidation: mocks.listenForAppStateInvalidation,
  listenForSettingsInvalidation: mocks.listenForSettingsInvalidation,
  listenForIntegrationsInvalidation: mocks.listenForIntegrationsInvalidation,
  listenForOpenSettings: mocks.listenForOpenSettings,
  listenForDebugReloadRequest: mocks.listenForDebugReloadRequest,
}));

vi.mock("./features/window/use-window-geometry", () => ({
  useWindowGeometryPersistence: vi.fn(),
}));

const emptyState: AppStateDto = {
  projects: [],
  lastSelectedProject: null,
  panelPreferences: {
    sidebarWidth: 224,
    sidebarCollapsed: false,
    drawerWidth: 480,
  },
  quickCapture: { lastProjectPath: null, position: null },
  onboardingStep: "addProject",
  recoveryWarning: null,
};

const projectState: AppStateDto = {
  projects: [{ path: "/project", name: "project", state: "writable" }],
  lastSelectedProject: "/project",
  panelPreferences: emptyState.panelPreferences,
  quickCapture: { lastProjectPath: "/project", position: null },
  onboardingStep: "complete",
  recoveryWarning: null,
};

const onboardingProjectState: AppStateDto = {
  ...projectState,
  onboardingStep: "quickCapture",
};

const workspace: WorkspaceSnapshotDto = {
  projectPath: "/project",
  access: "writable",
  quests: [],
  issues: [],
};

const populatedWorkspace: WorkspaceSnapshotDto = {
  ...workspace,
  quests: [
    {
      id: "sq_inbox",
      createdAt: "2026-08-23T10:00:00+08:00",
      content: "Inbox quest content",
      status: "inbox",
    },
    {
      id: "sq_ready",
      createdAt: "2026-08-22T10:00:00+08:00",
      content: "Ready quest content",
      status: "ready",
    },
    {
      id: "sq_done",
      createdAt: "2026-08-21T10:00:00+08:00",
      content: "Done quest content",
      status: "done",
    },
  ],
};

describe("App", () => {
  beforeEach(() => {
    useMainWindowStore.setState({
      view: { name: "restoring" },
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
      editor: null,
      statusMenuOpen: false,
      deleteConfirming: false,
      deleteError: null,
      navigationPending: false,
      navigationIntent: null,
    });
    mocks.getAppState.mockReset().mockResolvedValue(emptyState);
    mocks.addProject.mockReset().mockResolvedValue(onboardingProjectState);
    mocks.removeProject.mockReset().mockResolvedValue(emptyState);
    mocks.setLastSelectedProject.mockReset().mockResolvedValue(projectState);
    mocks.loadWorkspace.mockReset().mockResolvedValue(workspace);
    mocks.searchQuests.mockReset().mockResolvedValue(workspace);
    mocks.setWatchedProject.mockReset().mockResolvedValue(undefined);
    mocks.setPanelPreferences
      .mockReset()
      .mockResolvedValue(emptyState.panelPreferences);
    mocks.saveMainWindowGeometry.mockReset().mockResolvedValue(undefined);
    mocks.revealPath.mockReset().mockResolvedValue(undefined);
    mocks.relocateProject.mockReset().mockResolvedValue(projectState);
    mocks.selectProjectDirectory.mockReset().mockResolvedValue("/project");
    mocks.selectReplacementDirectory.mockReset().mockResolvedValue(null);
    mocks.listenForWorkspaceInvalidation
      .mockReset()
      .mockImplementation(
        async (handler: (payload: { projectPath: string }) => void) => {
          mocks.workspaceInvalidatedHandler = handler;
          return () => undefined;
        },
      );
    mocks.listenForAppStateInvalidation
      .mockReset()
      .mockResolvedValue(() => undefined);
    mocks.listenForSettingsInvalidation
      .mockReset()
      .mockResolvedValue(() => undefined);
    mocks.listenForIntegrationsInvalidation
      .mockReset()
      .mockResolvedValue(() => undefined);
    mocks.listenForOpenSettings.mockReset().mockResolvedValue(() => undefined);
    mocks.listenForDebugReloadRequest
      .mockReset()
      .mockResolvedValue(() => undefined);
    mocks.workspaceInvalidatedHandler = null;
    mocks.updateQuestContent
      .mockReset()
      .mockImplementation(
        async (_projectPath: string, id: string, content: string) => ({
          ...populatedWorkspace.quests.find((quest) => quest.id === id),
          id,
          content,
        }),
      );
    mocks.setQuestStatus
      .mockReset()
      .mockImplementation(
        async (_projectPath: string, id: string, status: string) => ({
          ...populatedWorkspace.quests.find((quest) => quest.id === id),
          id,
          status,
        }),
      );
    mocks.deleteQuest
      .mockReset()
      .mockImplementation(async (_path, id) => ({ id }));
    mocks.getSettings.mockReset().mockResolvedValue({
      shortcut: {
        modifiers: ["command", "shift"],
        key: "Space",
        display: "⌘⇧Space",
      },
      shortcutRegistration: "active",
      launchAtLogin: false,
      launchAtLoginAvailable: true,
      debugProfile: false,
      appVersion: "0.1.0",
      licenseText: "MIT License",
    });
    mocks.getLocaleSettings.mockReset().mockResolvedValue({
      preference: "system",
      effectiveLocale: "en",
    });
    mocks.getThemeSettings.mockReset().mockResolvedValue({
      preference: "system",
    });
    mocks.getIntegrationStatus.mockReset().mockResolvedValue([]);
    mocks.setOnboardingStep.mockReset().mockResolvedValue(projectState);
  });

  it("shows_onboarding_when_no_projects_are_registered", async () => {
    renderApp();

    expect(
      await screen.findByRole("heading", {
        name: "Add a project to get started",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Quick Capture" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "CLI and Sidequest Skill" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Command Line Tool" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Install Sidequest Skill",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveClass("overflow-hidden");
    expect(
      screen.queryByRole("button", { name: "Enter Sidequest" }),
    ).toBeNull();
  });

  it("installs_the_cli_from_onboarding", async () => {
    const integrations = [
      {
        id: "cli",
        state: "notInstalled",
        path: "/home/.local/bin/sq",
        installedVersion: null,
        bundledVersion: "0.1.0",
        message: null,
      },
      {
        id: "codex",
        state: "notInstalled",
        path: "/home/.codex/skills/sidequest/SKILL.md",
        installedVersion: null,
        bundledVersion: "0.1.0",
        message: null,
      },
      {
        id: "claude",
        state: "notInstalled",
        path: "/home/.claude/skills/sidequest/SKILL.md",
        installedVersion: null,
        bundledVersion: "0.1.0",
        message: null,
      },
    ];
    mocks.getIntegrationStatus.mockResolvedValue(integrations);
    mocks.installCli.mockResolvedValue(integrations);

    renderApp();
    const cliLabel = await screen.findByText("sq CLI");
    expect(screen.getAllByText("Sidequest Skill not installed")).toHaveLength(
      2,
    );
    const cliRow = cliLabel.closest<HTMLDivElement>("div.grid");
    expect(cliRow).not.toBeNull();
    fireEvent.click(within(cliRow!).getByRole("button", { name: "Install" }));

    await waitFor(() => expect(mocks.installCli).toHaveBeenCalledTimes(1));
  });

  it("stays_on_onboarding_after_adding_a_project_until_setup_is_finished", async () => {
    renderApp();
    fireEvent.click(
      await screen.findByRole("button", { name: "Choose Project Folder…" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "project is ready for Sidequest",
      }),
    ).toBeInTheDocument();
    expect(mocks.loadWorkspace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Enter Sidequest" }));

    expect(await screen.findAllByText("No quests")).toHaveLength(3);
    expect(mocks.addProject).toHaveBeenCalledWith(
      "/project",
      expect.anything(),
    );
    expect(mocks.setOnboardingStep).toHaveBeenCalledWith("complete");
    expect(mocks.loadWorkspace).toHaveBeenCalledWith("/project");
  });

  it("shows_the_recovery_backup_without_blocking_workspace_loading", async () => {
    mocks.getAppState.mockResolvedValue({
      ...projectState,
      recoveryWarning: {
        message: "Desktop state was recovered",
        path: "/data/app.json",
        backupPath: "/data/app.corrupt-1.json",
      },
    });

    renderApp();

    expect(
      await screen.findByText("Desktop state recovered"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Sidequest restored the app with safe default settings.",
      ),
    ).toBeInTheDocument();
  });

  it("renders_three_groups_and_reopens_a_quest_after_the_drawer_closes", async () => {
    mocks.getAppState.mockResolvedValue(projectState);
    mocks.loadWorkspace.mockResolvedValue(populatedWorkspace);

    renderApp();

    expect(
      await screen.findByRole("heading", { name: "Inbox" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ready" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Done" })).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Inbox quest content/ }),
    );
    expect(
      screen.getByRole("heading", { name: "Quest details" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Close Quest details" }),
    );

    expect(
      screen.queryByRole("heading", { name: "Quest details" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Inbox quest content/ }),
    );
    expect(
      screen.getByRole("heading", { name: "Quest details" }),
    ).toBeInTheDocument();
  });

  it("searches_the_current_project_and_clears_back_to_the_board", async () => {
    mocks.getAppState.mockResolvedValue(projectState);
    mocks.loadWorkspace.mockResolvedValue(populatedWorkspace);
    mocks.searchQuests.mockResolvedValue({
      ...populatedWorkspace,
      quests: [populatedWorkspace.quests[1]],
    });
    renderApp();
    await screen.findByRole("heading", { name: "Inbox" });

    fireEvent.change(
      screen.getByRole("textbox", { name: "Search current project" }),
      {
        target: { value: "ready" },
      },
    );

    await waitFor(() =>
      expect(mocks.searchQuests).toHaveBeenCalledWith("/project", "ready"),
    );
    expect(screen.getByRole("heading", { name: "Inbox" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ready" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Done" })).toBeInTheDocument();
    expect(screen.getByText("Ready quest content")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("Inbox quest content")).not.toBeInTheDocument(),
    );
    expect(mocks.searchQuests).toHaveBeenCalledWith("/project", "ready");
    fireEvent.click(screen.getByRole("button", { name: "Clear Search" }));
    expect(screen.getByRole("heading", { name: "Inbox" })).toBeInTheDocument();
  });

  it("renders_inbox_ready_and_done_as_three_kanban_lanes", async () => {
    mocks.getAppState.mockResolvedValue(projectState);
    mocks.loadWorkspace.mockResolvedValue(populatedWorkspace);
    renderApp();

    const board = await screen.findByLabelText("Quest board");
    expect(board).toHaveAttribute("data-layout", "kanban");
    expect(board.querySelectorAll(":scope > [data-status]")).toHaveLength(3);
    expect(board.querySelector('[data-status="inbox"]')).toBeInTheDocument();
    expect(board.querySelector('[data-status="ready"]')).toBeInTheDocument();
    expect(board.querySelector('[data-status="done"]')).toBeInTheDocument();
  });

  it("renders_the_first_content_line_as_the_card_title", async () => {
    mocks.getAppState.mockResolvedValue(projectState);
    mocks.loadWorkspace.mockResolvedValue({
      ...populatedWorkspace,
      quests: [
        {
          ...populatedWorkspace.quests[0],
          content: "Refine the board\nKeep the Quest model unchanged",
        },
      ],
    });
    renderApp();

    const card = await screen.findByRole("button", {
      name: /Refine the board/,
    });
    expect(within(card).getByText("Refine the board")).toBeInTheDocument();
    expect(
      within(card).getByText("Keep the Quest model unchanged"),
    ).toBeInTheDocument();
  });

  it("keeps_creation_in_the_toolbar_when_the_board_is_empty", async () => {
    mocks.getAppState.mockResolvedValue(projectState);
    mocks.loadWorkspace.mockResolvedValue(workspace);
    renderApp();

    await screen.findByRole("heading", { name: "Inbox" });
    const newQuestButtons = screen.getAllByRole("button", {
      name: "New Quest",
    });
    expect(newQuestButtons).toHaveLength(1);
    expect(within(newQuestButtons[0]).queryByText("Space")).toBeNull();
    expect(newQuestButtons[0].parentElement).toHaveAttribute(
      "data-base-ui-tooltip-trigger",
    );
    expect(screen.getAllByText("No quests")).toHaveLength(3);
  });

  it("shows_read_only_and_corrupt_file_banners_without_hiding_valid_quests", async () => {
    mocks.getAppState.mockResolvedValue({
      ...projectState,
      projects: [{ ...projectState.projects[0], state: "readOnly" }],
    });
    mocks.loadWorkspace.mockResolvedValue({
      ...populatedWorkspace,
      access: "readOnly",
      issues: [
        { path: "/project/.sidequest/quests/bad.md", message: "Invalid file" },
      ],
    });

    renderApp();

    expect(
      await screen.findByText(/project is read-only/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Inbox quest content")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View Details" }));
    expect(screen.getByText("Unreadable Quest file 1")).toBeInTheDocument();
    const card = screen.getByRole("button", { name: /Inbox quest content/ });
    expect(card).not.toHaveAttribute("draggable");
    expect(screen.getByRole("button", { name: "New Quest" })).toBeDisabled();
    fireEvent.click(card);
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move to Ready" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("textbox", { name: "Quest content" }),
    ).not.toBeInTheDocument();
  });

  it("renders_markdown_then_edits_the_raw_content_with_status_colored_actions", async () => {
    const markdownContent = "# Release notes\n\n- [x] Shipped";
    mocks.getAppState.mockResolvedValue(projectState);
    mocks.loadWorkspace.mockResolvedValue({
      ...populatedWorkspace,
      quests: [
        { ...populatedWorkspace.quests[0], content: markdownContent },
        ...populatedWorkspace.quests.slice(1),
      ],
    });

    renderApp();
    fireEvent.click(
      await screen.findByRole("button", { name: /Release notes/ }),
    );

    const drawer = screen.getByRole("dialog", { name: "Quest details" });
    expect(
      within(drawer).getByRole("heading", { name: "Release notes" }),
    ).toBeInTheDocument();
    expect(drawer.querySelector('input[type="checkbox"]')).toBeDisabled();
    expect(
      within(drawer).getByRole("button", { name: "Move to Ready" }),
    ).toHaveClass("text-status-ready");
    expect(drawer.querySelector("time")).toHaveClass("ml-auto", "text-right");

    fireEvent.click(
      within(drawer).getByRole("button", { name: /Release notes Shipped/ }),
    );

    expect(
      within(drawer).getByRole("textbox", { name: "Quest content" }),
    ).toHaveValue(markdownContent);
    expect(within(drawer).getByText("Markdown")).toBeInTheDocument();
  });

  it("offers_locate_for_an_unavailable_project_without_loading_it", async () => {
    mocks.getAppState.mockResolvedValue({
      ...projectState,
      projects: [{ ...projectState.projects[0], state: "unavailable" }],
    });
    mocks.selectReplacementDirectory.mockResolvedValue("/replacement");
    mocks.relocateProject.mockResolvedValue({
      ...projectState,
      projects: [
        { path: "/replacement", name: "replacement", state: "writable" },
      ],
      lastSelectedProject: "/replacement",
    });

    renderApp();
    fireEvent.click(
      await screen.findByRole("button", { name: /Locate Folder/ }),
    );

    await waitFor(() =>
      expect(mocks.relocateProject).toHaveBeenCalledWith(
        "/project",
        "/replacement",
      ),
    );
    expect(mocks.loadWorkspace).not.toHaveBeenCalledWith("/project");
  });

  it("keeps_settings_visible_and_enabled", async () => {
    mocks.getAppState.mockResolvedValue(projectState);
    renderApp();

    const settingsButton = await screen.findByRole("button", {
      name: "Settings",
    });
    expect(settingsButton).toBeEnabled();
    expect(within(settingsButton).getByText("⌘")).toBeInTheDocument();
    expect(within(settingsButton).getByText(",")).toBeInTheDocument();
    fireEvent.click(settingsButton);

    expect(
      await screen.findByRole("heading", { name: "General" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Settings" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
  });

  it("supports_command_f_and_escape_for_search", async () => {
    mocks.getAppState.mockResolvedValue(projectState);
    mocks.loadWorkspace.mockResolvedValue(populatedWorkspace);
    renderApp();
    await screen.findByRole("heading", { name: "Inbox" });
    const search = screen.getByRole("textbox", {
      name: "Search current project",
    });

    fireEvent.keyDown(window, { key: "f", metaKey: true });
    expect(search).toHaveFocus();
    fireEvent.change(search, { target: { value: "ready" } });
    fireEvent.keyDown(window, { key: "Escape" });

    expect(search).toHaveValue("");
    expect(search).not.toHaveFocus();
    expect(screen.getByRole("heading", { name: "Inbox" })).toBeInTheDocument();
  });

  it("confirms_project_removal_without_deleting_quests_by_default", async () => {
    mocks.getAppState.mockResolvedValue(projectState);
    renderApp();
    await screen.findByRole("heading", { name: "Inbox" });

    fireEvent.click(
      screen.getByRole("button", { name: "Project actions for project" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove Project" }));

    const dialog = screen.getByRole("alertdialog", {
      name: "Remove “project”?",
    });
    const deleteQuests = within(dialog).getByRole("checkbox", {
      name: /Remove all Quests/,
    });
    expect(deleteQuests).not.toBeChecked();
    expect(within(dialog).getByText("/project")).toBeInTheDocument();
    expect(within(dialog).getByText(/0 valid Quests/)).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove Project" }),
    );

    await waitFor(() =>
      expect(mocks.removeProject).toHaveBeenCalledWith("/project", false),
    );
  });

  it("deletes_sidequest_data_only_when_the_removal_option_is_checked", async () => {
    mocks.getAppState.mockResolvedValue(projectState);
    renderApp();
    await screen.findByRole("heading", { name: "Inbox" });

    fireEvent.click(
      screen.getByRole("button", { name: "Project actions for project" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove Project" }));

    const dialog = screen.getByRole("alertdialog", {
      name: "Remove “project”?",
    });
    const deleteQuests = within(dialog).getByRole("checkbox", {
      name: /Remove all Quests/,
    });
    fireEvent.click(deleteQuests);
    expect(deleteQuests).toBeChecked();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove Project" }),
    );

    await waitFor(() =>
      expect(mocks.removeProject).toHaveBeenCalledWith("/project", true),
    );
  });

  it("auto_saves_inline_content_and_keeps_the_drawer_open", async () => {
    mocks.getAppState.mockResolvedValue(projectState);
    mocks.loadWorkspace.mockResolvedValue(populatedWorkspace);
    renderApp();
    fireEvent.click(
      await screen.findByRole("button", { name: /Inbox quest content/ }),
    );
    const drawer = screen.getByRole("dialog", {
      name: "Quest details",
    });
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Inbox quest content" }),
    );
    fireEvent.change(
      within(drawer).getByRole("textbox", { name: "Quest content" }),
      { target: { value: "Updated inline content" } },
    );

    await waitFor(
      () =>
        expect(mocks.updateQuestContent).toHaveBeenCalledWith(
          "/project",
          "sq_inbox",
          "Updated inline content",
        ),
      { timeout: 1500 },
    );
    expect(
      screen.getByRole("heading", { name: "Quest details" }),
    ).toBeInTheDocument();
  });

  it("flushes_content_before_running_the_primary_status_action", async () => {
    mocks.getAppState.mockResolvedValue(projectState);
    mocks.loadWorkspace.mockResolvedValue(populatedWorkspace);
    renderApp();
    fireEvent.click(
      await screen.findByRole("button", { name: /Inbox quest content/ }),
    );
    const drawer = screen.getByRole("dialog", {
      name: "Quest details",
    });
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Inbox quest content" }),
    );
    fireEvent.change(within(drawer).getByRole("textbox"), {
      target: { value: "Ready after save" },
    });
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Move to Ready" }),
    );

    await waitFor(() => expect(mocks.setQuestStatus).toHaveBeenCalled());
    expect(mocks.updateQuestContent.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.setQuestStatus.mock.invocationCallOrder[0],
    );
    expect(mocks.setQuestStatus).toHaveBeenCalledWith(
      "/project",
      "sq_inbox",
      "ready",
    );
  });

  it("confirms_delete_and_removes_the_quest_from_the_board", async () => {
    mocks.getAppState.mockResolvedValue(projectState);
    mocks.loadWorkspace.mockResolvedValue(populatedWorkspace);
    renderApp();
    fireEvent.click(
      await screen.findByRole("button", { name: /Inbox quest content/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const dialog = screen.getByRole("alertdialog", {
      name: "Delete this Quest?",
    });
    expect(within(dialog).getByText(/Markdown file/)).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete Quest" }),
    );

    await waitFor(() =>
      expect(mocks.deleteQuest).toHaveBeenCalledWith("/project", "sq_inbox"),
    );
    expect(screen.queryByText("Inbox quest content")).not.toBeInTheDocument();
    expect(screen.getByText("Quest deleted")).toBeInTheDocument();
  });

  it("blocks_drawer_close_after_a_save_error_until_the_draft_is_discarded", async () => {
    mocks.getAppState.mockResolvedValue(projectState);
    mocks.loadWorkspace.mockResolvedValue(populatedWorkspace);
    mocks.updateQuestContent.mockRejectedValue(new Error("Disk is full"));
    renderApp();
    fireEvent.click(
      await screen.findByRole("button", { name: /Inbox quest content/ }),
    );
    const drawer = screen.getByRole("dialog", {
      name: "Quest details",
    });
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Inbox quest content" }),
    );
    fireEvent.change(within(drawer).getByRole("textbox"), {
      target: { value: "Unsaved local draft" },
    });
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Close Quest details" }),
    );

    expect(
      await screen.findByText("Content could not be saved"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Quest details" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Discard Local Changes" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Quest details" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("preserves_a_local_draft_when_the_watcher_loads_external_content", async () => {
    mocks.getAppState.mockResolvedValue(projectState);
    mocks.loadWorkspace.mockResolvedValue(populatedWorkspace);
    renderApp();
    fireEvent.click(
      await screen.findByRole("button", { name: /Inbox quest content/ }),
    );
    const drawer = screen.getByRole("dialog", {
      name: "Quest details",
    });
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Inbox quest content" }),
    );
    fireEvent.change(within(drawer).getByRole("textbox"), {
      target: { value: "Local draft wins only by choice" },
    });
    mocks.loadWorkspace.mockResolvedValue({
      ...populatedWorkspace,
      quests: populatedWorkspace.quests.map((quest) =>
        quest.id === "sq_inbox"
          ? { ...quest, content: "Changed by sq CLI" }
          : quest,
      ),
    });
    await waitFor(() =>
      expect(mocks.workspaceInvalidatedHandler).not.toBeNull(),
    );

    act(() => {
      mocks.workspaceInvalidatedHandler?.({ projectPath: "/project" });
    });

    expect(
      await screen.findByText("Quest changed outside Sidequest"),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Quest content" })).toHaveValue(
      "Local draft wins only by choice",
    );
    expect(mocks.updateQuestContent).not.toHaveBeenCalled();
  });

  it("keeps_a_copyable_draft_when_the_quest_is_deleted_externally", async () => {
    mocks.getAppState.mockResolvedValue(projectState);
    mocks.loadWorkspace.mockResolvedValue(populatedWorkspace);
    renderApp();
    fireEvent.click(
      await screen.findByRole("button", { name: /Inbox quest content/ }),
    );
    const drawer = screen.getByRole("dialog", {
      name: "Quest details",
    });
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Inbox quest content" }),
    );
    fireEvent.change(within(drawer).getByRole("textbox"), {
      target: { value: "Draft preserved after deletion" },
    });
    mocks.loadWorkspace.mockResolvedValue({
      ...populatedWorkspace,
      quests: populatedWorkspace.quests.filter(
        (quest) => quest.id !== "sq_inbox",
      ),
    });
    await waitFor(() =>
      expect(mocks.workspaceInvalidatedHandler).not.toBeNull(),
    );
    act(() => {
      mocks.workspaceInvalidatedHandler?.({ projectPath: "/project" });
    });

    expect(
      await screen.findByText("Quest was deleted outside Sidequest"),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Quest content" })).toHaveValue(
      "Draft preserved after deletion",
    );
    fireEvent.click(screen.getByRole("button", { name: "Discard Draft" }));
    expect(
      screen.queryByRole("heading", { name: "Quest details" }),
    ).not.toBeInTheDocument();
  });

  it("uses_pointer_dnd_instead_of_native_html_drag_attributes", async () => {
    mocks.getAppState.mockResolvedValue(projectState);
    mocks.loadWorkspace.mockResolvedValue(populatedWorkspace);
    renderApp();
    const card = await screen.findByRole("button", {
      name: /Inbox quest content/,
    });
    expect(card).not.toHaveAttribute("draggable");
    fireEvent.pointerDown(card, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { clientX: 14, clientY: 10 });
    fireEvent.pointerUp(window, { clientX: 14, clientY: 10 });
    expect(mocks.setQuestStatus).not.toHaveBeenCalled();
  });

  it("does_not_write_status_for_a_plain_row_click", async () => {
    mocks.getAppState.mockResolvedValue(projectState);
    mocks.loadWorkspace.mockResolvedValue(populatedWorkspace);
    renderApp();
    const card = await screen.findByRole("button", {
      name: /Inbox quest content/,
    });
    fireEvent.click(card);

    expect(mocks.setQuestStatus).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Quest details" }),
    ).toBeInTheDocument();
  });
});

function renderApp(): void {
  render(
    <QueryClientProvider client={createDesktopQueryClient()}>
      <App />
      <Toaster />
    </QueryClientProvider>,
  );
}
