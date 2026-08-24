import { X } from "lucide-react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IconButton } from "./icon-button";

describe("IconButton", () => {
  it("preserves_its_accessible_button_contract", () => {
    const onClick = vi.fn();
    render(<IconButton icon={X} label="Close" onClick={onClick} />);

    const button = screen.getByRole("button", { name: "Close" });
    expect(button).toHaveAttribute("title", "Close");
    expect(button).toHaveAttribute("type", "button");

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
