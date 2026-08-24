import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarkdownContent } from "./markdown-content";

describe("MarkdownContent", () => {
  it("renders_common_and_gfm_markdown_without_enabling_raw_html", () => {
    const { container } = render(
      <MarkdownContent
        content={[
          "# Release checklist",
          "",
          "- [x] Keep **status** colors",
          "- [ ] Verify `Markdown` editing",
          "",
          "<script>unsafe()</script>",
        ].join("\n")}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Release checklist" }),
    ).toBeInTheDocument();
    expect(screen.getByText("status").tagName).toBe("STRONG");
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(
      2,
    );
    expect(container.querySelector("script")).not.toBeInTheDocument();
  });

  it("shows_links_and_images_without_creating_navigation_or_network_nodes", () => {
    const { container } = render(
      <MarkdownContent content="Read [the guide](https://example.com) ![diagram](https://example.com/a.png)" />,
    );

    expect(screen.getByText("the guide")).toHaveAttribute(
      "title",
      "https://example.com",
    );
    expect(screen.getByText("[diagram]")).toBeInTheDocument();
    expect(container.querySelector("a")).not.toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });
});
