import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { HTMLAttributes } from "react";

import { cn } from "@/shared/lib/utils";

const markdownComponents: Components = {
  a: ({ children, href }) => (
    <span
      className="text-brand-foreground underline decoration-brand/40 underline-offset-2"
      title={href}
    >
      {children}
    </span>
  ),
  img: ({ alt, src }) => (
    <span
      className="inline-flex rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
      title={typeof src === "string" ? src : undefined}
    >
      [{alt?.trim() || "image"}]
    </span>
  ),
};

export function MarkdownContent({
  className,
  content,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  content: string;
}) {
  return (
    <div className={cn("quest-markdown", className)} {...props}>
      <ReactMarkdown
        components={markdownComponents}
        remarkPlugins={[remarkGfm]}
        skipHtml
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
