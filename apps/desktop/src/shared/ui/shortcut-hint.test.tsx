import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShortcutHint } from "./shortcut-hint";

describe("ShortcutHint", () => {
  it("splits_compact_modifier_glyphs_into_individual_keycaps", () => {
    const { container } = render(<ShortcutHint shortcut="⌘⇧Space" />);

    expect(container.querySelectorAll("kbd")).toHaveLength(3);
    expect(screen.getByText("⌘")).toBeInTheDocument();
    expect(screen.getByText("⇧")).toBeInTheDocument();
    expect(screen.getByText("Space")).toBeInTheDocument();
  });

  it("supports_spaced_shortcuts_and_hides_them_from_the_accessible_name", () => {
    const { container } = render(
      <ShortcutHint divided shortcut="⌘ Enter" tone="brand" />,
    );

    expect(container.querySelectorAll("kbd")).toHaveLength(2);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("offers_a_compact_keycap_density_without_collapsing_the_keys", () => {
    const { container } = render(
      <ShortcutHint density="compact" shortcut="⌘⇧Space" tone="brand" />,
    );

    const keys = container.querySelectorAll("kbd");
    expect(keys).toHaveLength(3);
    expect(keys[0]).toHaveClass("h-4", "text-[8px]");
    expect(container.firstElementChild).toHaveClass("opacity-70");
  });
});
