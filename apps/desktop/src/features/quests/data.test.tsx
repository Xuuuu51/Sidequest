import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { workspaceKeys } from "../workspace/data";
import type {
  QuestDto,
  QuestStatus,
  WorkspaceSnapshotDto,
} from "../../shared/tauri/types";
import {
  captureProjectCacheSnapshot,
  optimisticallySetQuestStatus,
  restoreProjectCacheSnapshot,
  useSetDraggedQuestStatusMutation,
} from "./data";

const mocks = vi.hoisted(() => ({ setQuestStatus: vi.fn() }));

vi.mock("../../shared/tauri/commands", () => ({
  setQuestStatus: mocks.setQuestStatus,
}));

const quest: QuestDto = {
  id: "sq_drag",
  createdAt: "2026-08-24T09:00:00+08:00",
  content: "Move me",
  status: "inbox",
};

const workspace: WorkspaceSnapshotDto = {
  projectPath: "/project",
  access: "writable",
  quests: [quest],
  issues: [],
};

describe("useSetDraggedQuestStatusMutation", () => {
  beforeEach(() => mocks.setQuestStatus.mockReset());

  it("optimistically_updates_workspace_and_every_search_cache_then_corrects_from_disk", async () => {
    const queryClient = createClient();
    seedProjectCaches(queryClient);
    let resolveWrite: (quest: QuestDto) => void = () => undefined;
    mocks.setQuestStatus.mockReturnValue(
      new Promise<QuestDto>((resolve) => {
        resolveWrite = resolve;
      }),
    );
    const { result } = renderHook(
      () => useSetDraggedQuestStatusMutation("/project"),
      { wrapper: wrapperFor(queryClient) },
    );

    const write = result.current("sq_drag", "ready");
    await waitFor(() =>
      expect(cachedStatus(queryClient)).toEqual(["ready", "ready"]),
    );

    resolveWrite({ ...quest, status: "ready", content: "Corrected by Core" });
    await write;
    expect(cachedContents(queryClient)).toEqual([
      "Corrected by Core",
      "Corrected by Core",
    ]);
  });

  it("restores_exact_workspace_and_search_snapshots_when_the_write_fails", async () => {
    const queryClient = createClient();
    seedProjectCaches(queryClient);
    const beforeWorkspace = queryClient.getQueryData(
      workspaceKeys.snapshot("/project"),
    );
    const beforeSearch = queryClient.getQueryData(
      workspaceKeys.search("/project", "move"),
    );
    const snapshot = captureProjectCacheSnapshot(queryClient, "/project");
    optimisticallySetQuestStatus(queryClient, "/project", "sq_drag", "done");
    expect(cachedStatus(queryClient)).toEqual(["done", "done"]);
    restoreProjectCacheSnapshot(queryClient, "/project", snapshot);

    expect(
      queryClient.getQueryData(workspaceKeys.snapshot("/project")),
    ).toStrictEqual(beforeWorkspace);
    expect(
      queryClient.getQueryData(workspaceKeys.search("/project", "move")),
    ).toStrictEqual(beforeSearch);
  });
});

function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
}

function seedProjectCaches(queryClient: QueryClient): void {
  queryClient.setQueryData(workspaceKeys.snapshot("/project"), workspace);
  queryClient.setQueryData(workspaceKeys.search("/project", "move"), workspace);
}

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function cachedStatus(queryClient: QueryClient): QuestStatus[] {
  return [
    queryClient.getQueryData<WorkspaceSnapshotDto>(
      workspaceKeys.snapshot("/project"),
    )?.quests[0]?.status,
    queryClient.getQueryData<WorkspaceSnapshotDto>(
      workspaceKeys.search("/project", "move"),
    )?.quests[0]?.status,
  ].filter((value): value is QuestStatus => value !== undefined);
}

function cachedContents(queryClient: QueryClient): string[] {
  return [
    queryClient.getQueryData<WorkspaceSnapshotDto>(
      workspaceKeys.snapshot("/project"),
    )?.quests[0]?.content,
    queryClient.getQueryData<WorkspaceSnapshotDto>(
      workspaceKeys.search("/project", "move"),
    )?.quests[0]?.content,
  ].filter((value): value is string => value !== undefined);
}
