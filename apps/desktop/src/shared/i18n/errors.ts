import { CommandError } from "../tauri/commands";
import { i18n } from "./i18n";

type ErrorKey =
  | "invalidArguments"
  | "projectNotFound"
  | "workspaceUnavailable"
  | "workspaceReadOnly"
  | "questNotFound"
  | "questFileInvalid"
  | "ioError"
  | "internalError";

const errorKeys: Record<string, ErrorKey> = {
  invalid_arguments: "invalidArguments",
  project_not_found: "projectNotFound",
  workspace_unavailable: "workspaceUnavailable",
  workspace_read_only: "workspaceReadOnly",
  quest_not_found: "questNotFound",
  quest_file_invalid: "questFileInvalid",
  io_error: "ioError",
  internal_error: "internalError",
};

export function localizedError(error: unknown): string {
  if (error instanceof CommandError) {
    const key = errorKeys[error.code];
    return key === undefined
      ? i18n.t("generic", { ns: "errors" })
      : i18n.t(key, { ns: "errors" });
  }
  return i18n.t("generic", { ns: "errors" });
}
