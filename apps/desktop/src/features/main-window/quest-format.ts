import type { QuestStatus } from "../../shared/tauri/types";

export function formatCreatedAt(createdAt: string): string {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) {
    return "Created at an unknown time";
  }
  const relativeSeconds = Math.round((created.getTime() - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(relativeSeconds);
  if (absoluteSeconds < 60) {
    return "Created just now";
  }
  if (absoluteSeconds < 3600) {
    return `Created ${new Intl.RelativeTimeFormat("en", {
      numeric: "auto",
    }).format(Math.round(relativeSeconds / 60), "minute")}`;
  }
  if (absoluteSeconds < 86_400) {
    return `Created ${new Intl.RelativeTimeFormat("en", {
      numeric: "auto",
    }).format(Math.round(relativeSeconds / 3600), "hour")}`;
  }
  if (absoluteSeconds < 604_800) {
    return `Created ${new Intl.RelativeTimeFormat("en", {
      numeric: "auto",
    }).format(Math.round(relativeSeconds / 86_400), "day")}`;
  }
  return `Created ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(created)}`;
}

export function statusLabel(status: QuestStatus): string {
  return status === "inbox" ? "Inbox" : status === "ready" ? "Ready" : "Done";
}
