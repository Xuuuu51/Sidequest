import { afterEach, describe, expect, it, vi } from "vitest";

import { i18n } from "../../shared/i18n/i18n";
import { formatCreatedAt, statusLabel } from "./quest-format";

describe("localized Quest formatting", () => {
  afterEach(async () => {
    vi.useRealTimers();
    await i18n.changeLanguage("en");
  });

  it("uses_the_active_locale_for_relative_dates_and_statuses", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T12:00:00Z"));
    await i18n.changeLanguage("zh-CN");

    expect(formatCreatedAt("2026-08-24T11:55:00Z")).toBe("创建于 5分钟前");
    expect(statusLabel("ready")).toBe("就绪");
  });

  it("uses_an_absolute_date_after_seven_days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T12:00:00Z"));
    await i18n.changeLanguage("en");

    expect(formatCreatedAt("2026-08-01T12:00:00Z")).toContain("Aug 1, 2026");
  });
});
