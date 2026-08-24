import type { QuestStatus } from "../../shared/tauri/types";
import { i18n } from "../../shared/i18n/i18n";

export function formatCreatedAt(createdAt: string): string {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) {
    return i18n.t("time.unknown", { ns: "common" });
  }
  const relativeSeconds = Math.round((created.getTime() - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(relativeSeconds);
  if (absoluteSeconds < 60) {
    return i18n.t("time.created", {
      ns: "common",
      value: i18n.t("time.justNow", { ns: "common" }),
    });
  }
  if (absoluteSeconds < 3600) {
    return i18n.t("time.created", {
      ns: "common",
      value: new Intl.RelativeTimeFormat(i18n.language, {
        numeric: "auto",
      }).format(Math.round(relativeSeconds / 60), "minute"),
    });
  }
  if (absoluteSeconds < 86_400) {
    return i18n.t("time.created", {
      ns: "common",
      value: new Intl.RelativeTimeFormat(i18n.language, {
        numeric: "auto",
      }).format(Math.round(relativeSeconds / 3600), "hour"),
    });
  }
  if (absoluteSeconds < 604_800) {
    return i18n.t("time.created", {
      ns: "common",
      value: new Intl.RelativeTimeFormat(i18n.language, {
        numeric: "auto",
      }).format(Math.round(relativeSeconds / 86_400), "day"),
    });
  }
  return i18n.t("time.created", {
    ns: "common",
    value: new Intl.DateTimeFormat(i18n.language, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(created),
  });
}

export function statusLabel(status: QuestStatus): string {
  return i18n.t(`status.${status}`, { ns: "common" });
}
