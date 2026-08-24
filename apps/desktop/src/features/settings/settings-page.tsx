import {
  ArrowLeft,
  Check,
  Command,
  Copy,
  SquareTerminal,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  useSetGlobalShortcutMutation,
  useSetLaunchAtLoginMutation,
  useSettingsQuery,
  useLocaleSettingsQuery,
  useSetLocalePreferenceMutation,
} from "./data";
import {
  useIntegrationMutation,
  useIntegrationsQuery,
} from "../integrations/data";
import type {
  IntegrationId,
  IntegrationItemDto,
  LanguagePreference,
  ShortcutModifier,
  ShortcutSpecDto,
} from "../../shared/tauri/types";
import {
  copyDiagnosticReport,
  revealDiagnosticLogs,
  revealPath,
} from "../../shared/tauri/commands";
import { IconButton } from "../../shared/ui/icon-button";
import { localizedError } from "../../shared/i18n/errors";
import { Button } from "../../shared/ui/button";
import { Switch } from "../../shared/ui/switch";
import { cn } from "../../shared/lib/utils";
import { useMainWindowStore } from "../../store/main-window/store";

interface SettingsPageProps {
  onBack: () => void;
  compact?: "quickCapture" | "codingAgents";
}

export function SettingsPage({ onBack, compact }: SettingsPageProps) {
  const { t } = useTranslation(["settings", "common", "errors"]);
  const settings = useSettingsQuery();
  const localeSettings = useLocaleSettingsQuery();
  const setLocale = useSetLocalePreferenceMutation();
  const integrations = useIntegrationsQuery();
  const setShortcut = useSetGlobalShortcutMutation();
  const setLaunch = useSetLaunchAtLoginMutation();
  const integrationMutation = useIntegrationMutation();
  const [recording, setRecording] = useState(false);
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticFeedback, setDiagnosticFeedback] = useState<string | null>(
    null,
  );
  const [confirming, setConfirming] = useState<IntegrationItemDto | null>(null);
  const sidebarCollapsed = useMainWindowStore(
    (state) => state.sidebarCollapsed,
  );

  useEffect(() => {
    if (compact === undefined) {
      void settings.refetch();
      void integrations.refetch();
    }
  }, [compact]); // eslint-disable-line react-hooks/exhaustive-deps

  async function changeShortcut(shortcut: ShortcutSpecDto): Promise<void> {
    setError(null);
    try {
      await setShortcut.mutateAsync(shortcut);
      setRecording(false);
    } catch (cause) {
      setError(localizedError(cause));
    }
  }

  async function runIntegration(
    item: IntegrationItemDto,
    action: "install" | "uninstall",
  ): Promise<void> {
    setError(null);
    try {
      await integrationMutation.mutateAsync({ id: item.id, action });
      setConfirming(null);
    } catch (cause) {
      setError(localizedError(cause));
    }
  }

  async function revealIntegration(item: IntegrationItemDto): Promise<void> {
    setError(null);
    try {
      await revealPath(item.path);
    } catch (cause) {
      setError(localizedError(cause));
    }
  }

  async function copyDiagnostics(): Promise<void> {
    setError(null);
    setDiagnosticFeedback(null);
    try {
      await copyDiagnosticReport();
      setDiagnosticFeedback(t("feedback.copied", { ns: "common" }));
    } catch (cause) {
      setError(localizedError(cause));
    }
  }

  async function revealLogs(): Promise<void> {
    setError(null);
    setDiagnosticFeedback(null);
    try {
      await revealDiagnosticLogs();
      setDiagnosticFeedback(t("feedback.revealedInFinder", { ns: "common" }));
    } catch (cause) {
      setError(localizedError(cause));
    }
  }

  return (
    <section
      className={cn(
        "relative flex min-w-0 flex-1 flex-col bg-workspace",
        compact && "mt-3 w-full flex-none bg-transparent",
      )}
    >
      {compact === undefined && (
        <header
          className={cn(
            "flex h-12 shrink-0 items-center gap-2 border-b pr-3",
            sidebarCollapsed ? "pl-[126px]" : "pl-3",
          )}
          data-tauri-drag-region="deep"
        >
          <IconButton
            data-tauri-drag-region="false"
            icon={ArrowLeft}
            label={t("actions.back", { ns: "common" })}
            onClick={onBack}
          />
          <h1 className="text-sm font-semibold">{t("title")}</h1>
        </header>
      )}
      <div
        className={cn(
          "w-full max-w-[760px] overflow-y-auto px-6 pb-10 pt-[22px]",
          compact && "max-w-none overflow-visible p-0",
        )}
      >
        {compact !== "codingAgents" && (
          <SettingsSection title={t("sections.general")}>
            {compact === undefined && (
              <SettingRow
                label={t("language.label")}
                description={t("language.description")}
              >
                <select
                  aria-label={t("language.label")}
                  className="h-8 rounded-md border border-input bg-surface px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={
                    localeSettings.data === undefined || setLocale.isPending
                  }
                  value={localeSettings.data?.preference ?? "system"}
                  onChange={(event) => {
                    setError(null);
                    void setLocale
                      .mutateAsync(event.target.value as LanguagePreference)
                      .catch(() =>
                        setError(t("languageSaveFailed", { ns: "errors" })),
                      );
                  }}
                >
                  <option value="system">{t("language.system")}</option>
                  <option value="en">{t("language.english")}</option>
                  <option value="zh-CN">
                    {t("language.simplifiedChinese")}
                  </option>
                </select>
              </SettingRow>
            )}
            <SettingRow
              label={t("shortcut.label")}
              description={t("shortcut.description")}
            >
              {settings.data !== undefined && (
                <ShortcutRecorder
                  error={
                    settings.data.shortcutRegistration === "conflict"
                      ? t("shortcut.unavailable")
                      : null
                  }
                  onCancel={() => setRecording(false)}
                  onRecord={(value) => void changeShortcut(value)}
                  recording={recording}
                  shortcut={settings.data.shortcut}
                  startRecording={() => setRecording(true)}
                />
              )}
              <Button
                disabled={setShortcut.isPending}
                onClick={() =>
                  void changeShortcut({
                    modifiers: ["command", "shift"],
                    key: "Space",
                    display: "⌘⇧Space",
                  })
                }
                size="sm"
                variant="ghost"
              >
                {t("shortcut.restoreDefault")}
              </Button>
            </SettingRow>
            <SettingRow
              label={t("launchAtLogin.label")}
              description={
                settings.data?.debugProfile
                  ? t("launchAtLogin.isolated")
                  : t("launchAtLogin.description")
              }
            >
              <Switch
                aria-label={t("launchAtLogin.label")}
                checked={settings.data?.launchAtLogin ?? false}
                disabled={
                  settings.data === undefined ||
                  !settings.data.launchAtLoginAvailable ||
                  setLaunch.isPending
                }
                onCheckedChange={(checked) => {
                  setError(null);
                  void setLaunch
                    .mutateAsync(checked)
                    .catch((cause: unknown) => setError(localizedError(cause)));
                }}
              />
            </SettingRow>
          </SettingsSection>
        )}

        {compact !== "quickCapture" && (
          <SettingsSection title={t("sections.codingAgents")}>
            {(["codex", "claude"] as const).map((id) => (
              <IntegrationRow
                item={integrations.data?.find((item) => item.id === id)}
                key={id}
                onAction={(item, action) => {
                  if (action === "reveal") {
                    void revealIntegration(item);
                    return;
                  }
                  if (action === "uninstall") setConfirming(item);
                  else void runIntegration(item, action);
                }}
                pending={integrationMutation.isPending}
              />
            ))}
          </SettingsSection>
        )}

        {compact === "quickCapture" && (
          <SettingsSection title={t("sections.commandLine")}>
            <IntegrationRow
              item={integrations.data?.find((item) => item.id === "cli")}
              onAction={(item, action) => {
                if (action === "reveal") {
                  void revealIntegration(item);
                  return;
                }
                if (action === "uninstall") setConfirming(item);
                else void runIntegration(item, action);
              }}
              pending={integrationMutation.isPending}
            />
          </SettingsSection>
        )}

        {compact === undefined && (
          <>
            <SettingsSection title={t("sections.commandLine")}>
              <IntegrationRow
                item={integrations.data?.find((item) => item.id === "cli")}
                onAction={(item, action) => {
                  if (action === "reveal") {
                    void revealIntegration(item);
                    return;
                  }
                  if (action === "uninstall") setConfirming(item);
                  else void runIntegration(item, action);
                }}
                pending={integrationMutation.isPending}
              />
            </SettingsSection>
            <SettingsSection title={t("sections.about")}>
              <SettingRow
                label="Sidequest"
                description={t("about.application")}
              >
                <span className="max-w-full overflow-hidden text-ellipsis text-[11px] leading-4 text-muted-foreground">
                  {t("about.version", {
                    version: settings.data?.appVersion ?? "—",
                  })}
                </span>
              </SettingRow>
              <SettingRow
                label={t("about.diagnostics")}
                description={t("about.diagnosticsDescription")}
              >
                {diagnosticFeedback !== null && (
                  <span
                    className="whitespace-nowrap text-[11px] text-muted-foreground"
                    role="status"
                  >
                    {diagnosticFeedback}
                  </span>
                )}
                <Button
                  onClick={() => void copyDiagnostics()}
                  size="sm"
                  variant="outline"
                >
                  {t("about.copyDiagnostics")}
                </Button>
                <Button
                  onClick={() => void revealLogs()}
                  size="sm"
                  variant="outline"
                >
                  {t("about.revealLogs")}
                </Button>
              </SettingRow>
              <SettingRow
                label={t("about.license")}
                description={t("about.licenseDescription")}
              >
                <Button
                  onClick={() => setLicenseOpen(true)}
                  size="sm"
                  variant="outline"
                >
                  {t("about.viewLicense")}
                </Button>
              </SettingRow>
            </SettingsSection>
          </>
        )}

        {(error !== null || settings.isError || integrations.isError) && (
          <p
            className="flex items-center gap-1.5 text-[11px] text-destructive"
            role="alert"
          >
            <TriangleAlert aria-hidden="true" size={14} />
            {error ?? localizedError(settings.error ?? integrations.error)}
          </p>
        )}
      </div>

      {confirming !== null && (
        <div
          aria-labelledby="integration-confirm-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/55"
          role="alertdialog"
        >
          <div className="w-[420px] rounded-xl border bg-elevated p-4 text-elevated-foreground shadow-overlay">
            <h2
              className="text-sm font-semibold"
              id="integration-confirm-title"
            >
              {t("integration.confirmUninstall", {
                name: integrationName(confirming.id),
              })}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("integration.removeManaged")}
            </p>
            <code className="mt-3 block select-text border bg-background p-2 text-xs [overflow-wrap:anywhere]">
              {confirming.path}
            </code>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                autoFocus
                onClick={() => setConfirming(null)}
                variant="outline"
              >
                {t("actions.cancel", { ns: "common" })}
              </Button>
              <Button
                onClick={() => void runIntegration(confirming, "uninstall")}
                variant="destructive"
              >
                {t("actions.uninstall", { ns: "common" })}
              </Button>
            </div>
          </div>
        </div>
      )}

      {licenseOpen && settings.data !== undefined && (
        <div
          aria-labelledby="license-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/55"
          role="dialog"
        >
          <div className="flex max-h-[70vh] w-[580px] flex-col rounded-xl border bg-elevated p-4 text-elevated-foreground shadow-overlay">
            <header className="flex items-center justify-between border-b pb-2">
              <h2 className="text-sm font-semibold" id="license-title">
                {t("about.licenseTitle")}
              </h2>
              <IconButton
                icon={X}
                label={t("about.closeLicense")}
                onClick={() => setLicenseOpen(false)}
              />
            </header>
            <pre className="mt-3 select-text overflow-auto whitespace-pre-wrap font-mono text-xs leading-[18px] text-muted-foreground">
              {settings.data.licenseText}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-[26px] w-full">
      <h2 className="mb-2 text-xs font-semibold text-muted-foreground">
        {title}
      </h2>
      <div className="border-t">{children}</div>
    </section>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[58px] items-center gap-3 border-b px-0.5 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <strong className="text-[13px] font-medium">{label}</strong>
        <span className="overflow-hidden text-ellipsis text-[11px] leading-4 text-muted-foreground">
          {description}
        </span>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function ShortcutRecorder({
  shortcut,
  recording,
  error,
  startRecording,
  onCancel,
  onRecord,
}: {
  shortcut: ShortcutSpecDto;
  recording: boolean;
  error: string | null;
  startRecording: () => void;
  onCancel: () => void;
  onRecord: (shortcut: ShortcutSpecDto) => void;
}) {
  const { t } = useTranslation("settings");
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      onCancel();
      return;
    }
    if (["Meta", "Control", "Alt", "Shift"].includes(event.key)) return;
    const modifiers: ShortcutModifier[] = [];
    if (event.metaKey) modifiers.push("command");
    if (event.ctrlKey) modifiers.push("control");
    if (event.altKey) modifiers.push("option");
    if (event.shiftKey) modifiers.push("shift");
    onRecord({
      modifiers,
      key: event.key === " " ? "Space" : event.key,
      display: "",
    });
  }
  return (
    <div className="flex flex-col items-end">
      <Button
        aria-pressed={recording}
        className={cn(
          "min-w-[116px] font-mono",
          recording && "ring-2 ring-ring",
        )}
        onClick={startRecording}
        onKeyDown={handleKeyDown}
        variant="outline"
      >
        <Command aria-hidden="true" size={14} />
        {recording ? t("shortcut.recording") : shortcut.display}
      </Button>
      {error !== null && (
        <span className="text-[11px] text-destructive">{error}</span>
      )}
    </div>
  );
}

function IntegrationRow({
  item,
  pending,
  onAction,
}: {
  item?: IntegrationItemDto;
  pending: boolean;
  onAction: (
    item: IntegrationItemDto,
    action: "install" | "uninstall" | "reveal",
  ) => void;
}) {
  const { t } = useTranslation(["settings", "common"]);
  const id = item?.id ?? "cli";
  const needsAttention =
    item !== undefined &&
    ["updateAvailable", "repairRequired", "conflict", "unavailable"].includes(
      item.state,
    );
  const installed = item?.state === "installed";
  const blocked = item?.state === "conflict" || item?.state === "unavailable";
  const action = blocked ? "reveal" : installed ? "uninstall" : "install";
  const label = installed
    ? t("actions.uninstall", { ns: "common" })
    : blocked
      ? t("actions.reveal", { ns: "common" })
      : item?.state === "updateAvailable"
        ? t("actions.update", { ns: "common" })
        : item?.state === "repairRequired"
          ? t("actions.repair", { ns: "common" })
          : t("actions.install", { ns: "common" });
  return (
    <div className="flex min-h-[52px] items-center gap-3 border-b px-0.5 py-2.5">
      <div className="inline-flex size-[26px] items-center justify-center rounded-md border bg-elevated text-muted-foreground">
        {id === "cli" ? (
          <SquareTerminal size={15} />
        ) : id === "codex" ? (
          <Copy size={15} />
        ) : (
          <Command size={15} />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <strong className="text-[13px] font-medium">
          {integrationName(id)}
        </strong>
        <span className="overflow-hidden text-ellipsis text-[11px] leading-4 text-muted-foreground">
          {item === undefined
            ? t("integration.loading", { ns: "settings" })
            : integrationDescription(
                item,
                t("integration.installed", { ns: "settings" }),
                t("integration.notInstalled", { ns: "settings" }),
                t("integration.needsAttention", { ns: "settings" }),
              )}
        </span>
      </div>
      <span
        className={cn(
          "inline-flex min-w-[82px] items-center justify-end gap-1 text-[11px] text-muted-foreground",
          needsAttention && "text-warning",
        )}
      >
        {installed ? (
          <Check size={13} />
        ) : needsAttention ? (
          <TriangleAlert size={13} />
        ) : null}
        {installed
          ? t("integration.installed", { ns: "settings" })
          : needsAttention
            ? t("integration.needsAttention", { ns: "settings" })
            : t("integration.notInstalled", { ns: "settings" })}
      </span>
      <Button
        disabled={item === undefined || pending}
        onClick={() => item !== undefined && onAction(item, action)}
        size="sm"
        variant="outline"
      >
        {label}
      </Button>
    </div>
  );
}

function integrationName(id: IntegrationId): string {
  return id === "cli" ? "sq CLI" : id === "codex" ? "Codex" : "Claude";
}

function integrationDescription(
  item: IntegrationItemDto,
  installed: string,
  notInstalled: string,
  needsAttention: string,
): string {
  if (item.state === "installed") return installed;
  if (item.state === "notInstalled") return notInstalled;
  return needsAttention;
}
