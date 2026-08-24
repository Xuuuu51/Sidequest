import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentWindowTheme: vi.fn(),
  isTauriRuntime: vi.fn(),
  logFrontendError: vi.fn(),
  setCurrentWindowTheme: vi.fn(),
}));

vi.mock("../tauri/window", () => ({
  getCurrentWindowTheme: mocks.getCurrentWindowTheme,
  isTauriRuntime: mocks.isTauriRuntime,
  setCurrentWindowTheme: mocks.setCurrentWindowTheme,
}));
vi.mock("../diagnostics/logger", () => ({
  logFrontendError: mocks.logFrontendError,
}));

import { applyThemePreference } from "./theme";

describe("theme application", () => {
  beforeEach(() => {
    mocks.getCurrentWindowTheme.mockReset().mockResolvedValue("light");
    mocks.isTauriRuntime.mockReset().mockReturnValue(true);
    mocks.logFrontendError.mockReset();
    mocks.setCurrentWindowTheme.mockReset().mockResolvedValue(undefined);
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  });

  it("applies_an_explicit_native_and_document_theme", async () => {
    await applyThemePreference("dark");

    expect(mocks.setCurrentWindowTheme).toHaveBeenCalledWith("dark");
    expect(mocks.getCurrentWindowTheme).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("resolves_system_theme_through_the_current_tauri_window", async () => {
    mocks.getCurrentWindowTheme.mockResolvedValue("dark");

    await applyThemePreference("system");

    expect(mocks.setCurrentWindowTheme).toHaveBeenCalledWith(null);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("keeps_a_readable_css_fallback_when_native_theming_fails", async () => {
    mocks.setCurrentWindowTheme.mockRejectedValue(new Error("unavailable"));
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });

    await applyThemePreference("system");

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(mocks.logFrontendError).toHaveBeenCalledOnce();
  });

  it("uses_match_media_outside_tauri", async () => {
    mocks.isTauriRuntime.mockReturnValue(false);
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });

    await applyThemePreference("system");

    expect(mocks.setCurrentWindowTheme).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
