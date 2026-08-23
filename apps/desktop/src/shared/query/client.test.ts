import { describe, expect, it } from "vitest";

import { createDesktopQueryClient } from "./client";

describe("createDesktopQueryClient", () => {
  it("disables_network_style_refresh_and_retry_defaults", () => {
    const options = createDesktopQueryClient().getDefaultOptions();

    expect(options.queries).toMatchObject({
      retry: false,
      staleTime: Number.POSITIVE_INFINITY,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
      refetchInterval: false,
    });
    expect(options.mutations).toMatchObject({ retry: false });
  });
});
