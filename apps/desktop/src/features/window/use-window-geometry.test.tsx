import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveMainWindowGeometry: vi.fn(),
  destroy: vi.fn(),
  onMoved: vi.fn(),
  onResized: vi.fn(),
  onCloseRequested: vi.fn(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    destroy: mocks.destroy,
    onMoved: mocks.onMoved,
    onResized: mocks.onResized,
    onCloseRequested: mocks.onCloseRequested,
  }),
}));

vi.mock("../../shared/tauri/commands", () => ({
  saveMainWindowGeometry: mocks.saveMainWindowGeometry,
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
    mocks.saveMainWindowGeometry.mockReset().mockResolvedValue(undefined);
    mocks.destroy.mockReset().mockResolvedValue(undefined);
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

  it("flushes_geometry_before_destroying_the_window", async () => {
    renderHook(() => useWindowGeometryPersistence());
    expect(mocks.onCloseRequested).toHaveBeenCalled();
    const close = mocks.onCloseRequested.mock.calls[0][0] as (event: {
      preventDefault: () => void;
    }) => Promise<void>;
    const preventDefault = vi.fn();

    await act(() => close({ preventDefault }));

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(mocks.saveMainWindowGeometry).toHaveBeenCalledTimes(1);
    expect(mocks.destroy).toHaveBeenCalledTimes(1);
  });
});
