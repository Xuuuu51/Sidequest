import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ResizeHandle } from "./resize-handle";

describe("ResizeHandle", () => {
  it("supports_keyboard_resize_and_commits_the_clamped_value", () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    render(
      <ResizeHandle
        ariaLabel="Resize panel"
        direction={1}
        maximum={320}
        minimum={180}
        onChange={onChange}
        onCommit={onCommit}
        value={316}
      />,
    );

    fireEvent.keyDown(screen.getByRole("separator", { name: "Resize panel" }), {
      key: "ArrowRight",
    });

    expect(onChange).toHaveBeenCalledWith(320);
    expect(onCommit).toHaveBeenCalledWith(320);
  });

  it("reverses_arrow_direction_for_a_left_edge_drawer", () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    render(
      <ResizeHandle
        ariaLabel="Resize drawer"
        direction={-1}
        maximum={560}
        minimum={420}
        onChange={onChange}
        onCommit={onCommit}
        value={480}
      />,
    );

    fireEvent.keyDown(
      screen.getByRole("separator", { name: "Resize drawer" }),
      {
        key: "ArrowLeft",
        shiftKey: true,
      },
    );

    expect(onChange).toHaveBeenCalledWith(504);
    expect(onCommit).toHaveBeenCalledWith(504);
  });
});
