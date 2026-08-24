import type { PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDesktopQueryClient } from "../../shared/query/client";
import type { WorkspaceInvalidatedDto } from "../../shared/tauri/types";
import { useWorkspaceWatcher } from "./data";

const mocks = vi.hoisted(() => ({
  setWatchedProject: vi.fn(),
  listenForWorkspaceInvalidation: vi.fn(),
}));

vi.mock("../../shared/tauri/commands", () => ({
  setWatchedProject: mocks.setWatchedProject,
}));

vi.mock("../../shared/tauri/events", () => ({
  listenForWorkspaceInvalidation: mocks.listenForWorkspaceInvalidation,
}));

describe("useWorkspaceWatcher", () => {
  let listener: ((payload: WorkspaceInvalidatedDto) => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    listener = undefined;
    mocks.setWatchedProject.mockReset().mockResolvedValue(undefined);
    mocks.listenForWorkspaceInvalidation
      .mockReset()
      .mockImplementation(
        (handler: (payload: WorkspaceInvalidatedDto) => void) => {
          listener = handler;
          return Promise.resolve(() => undefined);
        },
      );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("trailing_debounces_events_and_invalidates_only_the_matching_project", async () => {
    const queryClient = createDesktopQueryClient();
    const invalidate = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    renderHook(() => useWorkspaceWatcher("/project"), { wrapper });
    expect(listener).toBeDefined();

    act(() => {
      listener?.({ projectPath: "/project" });
      listener?.({ projectPath: "/project" });
      vi.advanceTimersByTime(149);
    });
    expect(invalidate).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(invalidate).toHaveBeenNthCalledWith(1, {
      queryKey: ["workspace", "/project"],
    });
    expect(invalidate).toHaveBeenNthCalledWith(2, {
      queryKey: ["search", "/project"],
    });
    expect(invalidate).toHaveBeenNthCalledWith(3, {
      queryKey: ["app-state"],
    });
    expect(mocks.setWatchedProject).toHaveBeenCalledWith("/project");
  });
});
