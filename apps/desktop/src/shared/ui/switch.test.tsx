import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Switch } from "./switch";

describe("Switch", () => {
  it("centers_the_thumb_inside_the_track", () => {
    render(<Switch aria-label="Launch at Login" />);

    const control = screen.getByRole("switch", { name: "Launch at Login" });
    expect(control).toHaveClass("items-center");
    expect(control.firstElementChild).toHaveClass("size-3.5");
  });
});
