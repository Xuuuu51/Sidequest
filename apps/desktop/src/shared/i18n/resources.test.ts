import { describe, expect, it } from "vitest";

import { resources } from "./resources";

describe("translation resources", () => {
  it("keeps_keys_and_interpolation_placeholders_in_parity", () => {
    for (const namespace of Object.keys(resources.en) as Array<
      keyof typeof resources.en
    >) {
      const english = flatten(resources.en[namespace]);
      const chinese = flatten(resources["zh-CN"][namespace]);
      expect(Object.keys(chinese).sort()).toEqual(Object.keys(english).sort());
      for (const key of Object.keys(english)) {
        expect(placeholders(chinese[key])).toEqual(placeholders(english[key]));
      }
    }
  });

  it("uses_the_product_language_for_the_chinese_inbox_status", () => {
    expect(resources["zh-CN"].common.status.inbox).toBe("待整理");
    expect(resources["zh-CN"]["main-window"].statusControl.moveToInbox).toBe(
      "移至待整理",
    );
  });
});

function flatten(
  value: object,
  prefix = "",
  output: Record<string, string> = {},
): Record<string, string> {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    if (typeof child === "string") output[path] = child;
    else if (typeof child === "object" && child !== null)
      flatten(child, path, output);
  }
  return output;
}

function placeholders(value: string): string[] {
  return [...value.matchAll(/{{\s*([^},\s]+)[^}]*}}/g)]
    .map((match) => match[1] ?? "")
    .sort();
}
