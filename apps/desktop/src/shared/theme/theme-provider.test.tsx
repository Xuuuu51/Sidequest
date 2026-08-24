import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ThemePreference } from "../tauri/types";

const mocks = vi.hoisted(() => ({
  isTauriRuntime: vi.fn(),
  listenForCurrentWindowThemeChange: vi.fn(),
  listenForThemeChange: vi.fn(),
  logFrontendError: vi.fn(),
  themeHandler: undefined as
    ((preference: ThemePreference) => void) | undefined,
}));

vi.mock("../tauri/events", () => ({
  listenForThemeChange: mocks.listenForThemeChange,
}));
vi.mock("../tauri/window", () => ({
  getCurrentWindowTheme: vi.fn(),
  isTauriRuntime: mocks.isTauriRuntime,
  listenForCurrentWindowThemeChange: mocks.listenForCurrentWindowThemeChange,
  setCurrentWindowTheme: vi.fn(),
}));
vi.mock("../diagnostics/logger", () => ({
  logFrontendError: mocks.logFrontendError,
}));

import { themeSettingsKey } from "./theme";
import { ThemeProvider } from "./theme-provider";

describe("ThemeProvider", () => {
  beforeEach(() => {
    mocks.isTauriRuntime.mockReset().mockReturnValue(true);
    mocks.listenForCurrentWindowThemeChange
      .mockReset()
      .mockResolvedValue(vi.fn());
    mocks.listenForThemeChange.mockReset().mockImplementation((handler) => {
      mocks.themeHandler = handler;
      return Promise.resolve(vi.fn());
    });
    mocks.logFrontendError.mockReset();
    mocks.themeHandler = undefined;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  it("updates_the_document_and_query_cache_when_native_preference_changes", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <div>content</div>
        </ThemeProvider>
      </QueryClientProvider>,
    );
    await vi.waitFor(() => expect(mocks.themeHandler).toBeTypeOf("function"));

    await act(async () => mocks.themeHandler?.("dark"));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(queryClient.getQueryData(themeSettingsKey)).toEqual({
      preference: "dark",
    });
  });
});
