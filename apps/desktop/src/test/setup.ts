import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { i18n, initializeI18nForLocale } from "../shared/i18n/i18n";

class TestResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver ??= TestResizeObserver;

beforeAll(async () => initializeI18nForLocale("en"));
afterAll(async () => i18n.changeLanguage("en"));

afterEach(cleanup);
