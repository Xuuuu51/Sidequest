import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveMainWindowGeometry: vi.fn(),
  completeAppQuit: vi.fn(),
  hideMainWindow: vi.fn(),
  listenForAppQuitRequest: vi.fn(),
  listenForHideMainWindowRequest: vi.fn(),
  onMoved: vi.fn(),
  onResized: vi.fn(),
  onCloseRequested: vi.fn(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onMoved: mocks.onMoved,
    onResized: mocks.onResized,
    onCloseRequested: mocks.onCloseRequested,
  }),
}));

vi.mock("../../shared/tauri/commands", () => ({
  saveMainWindowGeometry: mocks.saveMainWindowGeometry,
  hideMainWindow: mocks.hideMainWindow,
  completeAppQuit: mocks.completeAppQuit,
}));

vi.mock("../../shared/tauri/events", () => ({
  listenForAppQuitRequest: mocks.listenForAppQuitRequest,
  listenForHideMainWindowRequest: mocks.listenForHideMainWindowRequest,
}));

import { useWindowGeometryPersistence } from "./use-window-geometry";

describe("useWindowGeometryPersistence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const subscribe = (listener: unknown) => {
      void listener;
      return Promise.resolve(vi.fn());
    };
    mocks.onMoved.mockReset().mockImplementation(subscribe);
    mocks.onResized.mockReset().mockImplementation(subscribe);
    mocks.onCloseRequested.mockReset().mockImplementation(subscribe);
    mocks.listenForAppQuitRequest.mockReset().mockImplementation(subscribe);
    mocks.listenForHideMainWindowRequest
      .mockReset()
      .mockImplementation(subscribe);
    mocks.saveMainWindowGeometry.mockReset().mockResolvedValue(undefined);
    mocks.completeAppQuit.mockReset().mockResolvedValue(undefined);
    mocks.hideMainWindow.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces_move_and_resize_events", () => {
    renderHook(() => useWindowGeometryPersistence());
    expect(mocks.onMoved).toHaveBeenCalled();
    const moved = mocks.onMoved.mock.calls[0][0] as () => void;
    const resized = mocks.onResized.mock.calls[0][0] as () => void;

    act(() => {
      moved();
      resized();
      vi.advanceTimersByTime(299);
    });
    expect(mocks.saveMainWindowGeometry).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(mocks.saveMainWindowGeometry).toHaveBeenCalledTimes(1);
  });

  it("flushes_geometry_before_hiding_the_window", async () => {
    renderHook(() => useWindowGeometryPersistence());
    expect(mocks.onCloseRequested).toHaveBeenCalled();
    const close = mocks.onCloseRequested.mock.calls[0][0] as (event: {
      preventDefault: () => void;
    }) => Promise<void>;
    const preventDefault = vi.fn();

    await act(() => close({ preventDefault }));

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(mocks.saveMainWindowGeometry).toHaveBeenCalledTimes(1);
    expect(mocks.hideMainWindow).toHaveBeenCalledTimes(1);
  });

  it("routes_native_quit_requests_through_the_navigation_guard", async () => {
    const guard = vi.fn(
      async (action: () => void | Promise<void>, intent?: string) => {
        expect(intent).toBe("quit");
        await action();
        return true;
      },
    );
    renderHook(() => useWindowGeometryPersistence(guard));
    const quit = mocks.listenForAppQuitRequest.mock.calls[0][0] as () => void;

    await act(async () => quit());

    expect(guard).toHaveBeenCalled();
    expect(mocks.completeAppQuit).toHaveBeenCalledTimes(1);
  });

  it("routes_status_item_hide_requests_through_the_navigation_guard", async () => {
    const guard = vi.fn(
      async (action: () => void | Promise<void>, intent?: string) => {
        expect(intent).toBe("hide");
        await action();
        return true;
      },
    );
    renderHook(() => useWindowGeometryPersistence(guard));
    const hide = mocks.listenForHideMainWindowRequest.mock
      .calls[0][0] as () => void;

    await act(async () => hide());

    expect(guard).toHaveBeenCalledTimes(1);
    expect(mocks.saveMainWindowGeometry).toHaveBeenCalledTimes(1);
    expect(mocks.hideMainWindow).toHaveBeenCalledTimes(1);
  });

  it("keeps_the_window_visible_when_the_hide_guard_rejects_navigation", async () => {
    const guard = vi.fn(async () => false);
    renderHook(() => useWindowGeometryPersistence(guard));
    const hide = mocks.listenForHideMainWindowRequest.mock
      .calls[0][0] as () => void;

    await act(async () => hide());

    expect(guard).toHaveBeenCalledTimes(1);
    expect(mocks.saveMainWindowGeometry).not.toHaveBeenCalled();
    expect(mocks.hideMainWindow).not.toHaveBeenCalled();
  });
});
