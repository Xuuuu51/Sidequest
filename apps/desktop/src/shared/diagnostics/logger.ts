import {
  debug as writeDebug,
  error as writeError,
  info as writeInfo,
  warn as writeWarning,
} from "@tauri-apps/plugin-log";

export function logDebug(message: string): void {
  void safelyLog(writeDebug, message);
}

export function logInfo(message: string): void {
  void safelyLog(writeInfo, message);
}

export function logWarning(message: string): void {
  void safelyLog(writeWarning, message);
}

export function logFrontendError(context: string, cause: unknown): void {
  void safelyLog(writeError, `${context}: ${safeErrorIdentity(cause)}`);
}

export function installGlobalErrorLogging(): () => void {
  const handleError = (event: ErrorEvent) => {
    logFrontendError("unhandled window error", event.error ?? event.message);
  };
  const handleRejection = (event: PromiseRejectionEvent) => {
    logFrontendError("unhandled promise rejection", event.reason);
  };
  window.addEventListener("error", handleError);
  window.addEventListener("unhandledrejection", handleRejection);
  return () => {
    window.removeEventListener("error", handleError);
    window.removeEventListener("unhandledrejection", handleRejection);
  };
}

function safeErrorIdentity(cause: unknown): string {
  if (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    typeof cause.code === "string"
  ) {
    return `command error code=${cause.code}`;
  }
  if (cause instanceof Error) {
    return `error name=${cause.name}`;
  }
  return `non-error type=${typeof cause}`;
}

async function safelyLog(
  writer: (message: string) => Promise<void>,
  message: string,
): Promise<void> {
  try {
    await writer(message);
  } catch {
    // Logging must never become a new application failure path.
  }
}
