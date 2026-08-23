import { describe, expect, it } from "vitest";

import { applicationKindForWindowLabel } from "./app-entry";

describe("applicationForWindowLabel", () => {
  it("routes_native_window_labels_to_independent_application_roots", () => {
    expect(applicationKindForWindowLabel("main")).toBe("main");
    expect(applicationKindForWindowLabel("quick-capture")).toBe("quickCapture");
  });
});
