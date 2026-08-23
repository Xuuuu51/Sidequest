export type ApplicationKind = "main" | "quickCapture";

export function applicationKindForWindowLabel(label: string): ApplicationKind {
  return label === "quick-capture" ? "quickCapture" : "main";
}
