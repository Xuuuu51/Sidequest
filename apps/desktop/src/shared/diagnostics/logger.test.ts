import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-log", () => ({
  debug: vi.fn().mockResolvedValue(undefined),
  error: mocks.error,
  info: vi.fn().mockResolvedValue(undefined),
  warn: vi.fn().mockResolvedValue(undefined),
}));

import { installGlobalErrorLogging, logFrontendError } from "./logger";

beforeEach(() => mocks.error.mockReset().mockResolvedValue(undefined));

it("logs_command_codes_without_messages_or_paths", async () => {
  logFrontendError("command failed", {
    code: "workspace_unavailable",
    message: "private content",
    path: "/Users/developer/secret",
  });

  await vi.waitFor(() => expect(mocks.error).toHaveBeenCalled());
  expect(mocks.error.mock.calls[0][0]).toBe(
    "command failed: command error code=workspace_unavailable",
  );
});

it("captures_unhandled_promise_rejections", async () => {
  const uninstall = installGlobalErrorLogging();

  window.dispatchEvent(
    new PromiseRejectionEvent("unhandledrejection", {
      promise: Promise.resolve(),
      reason: new Error("sensitive message"),
    }),
  );

  await vi.waitFor(() => expect(mocks.error).toHaveBeenCalled());
  expect(mocks.error.mock.calls[0][0]).toContain("error name=Error");
  uninstall();
});
