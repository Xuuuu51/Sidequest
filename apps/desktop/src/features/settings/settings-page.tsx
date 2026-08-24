import {
  ArrowLeft,
  Check,
  Command,
  Copy,
  TerminalWindow,
  Warning,
  X,
} from "@phosphor-icons/react";
import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  useIntegrationMutation,
  useIntegrationsQuery,
  useSetGlobalShortcutMutation,
  useSetLaunchAtLoginMutation,
  useSettingsQuery,
  useLocaleSettingsQuery,
  useSetLocalePreferenceMutation,
} from "../data/queries";
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
import { useMainWindowStore } from "../../store/main-window";
import { localizedError } from "../../shared/i18n/errors";

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
  const recording = useMainWindowStore((state) => state.shortcutRecording);
  const setRecording = useMainWindowStore(
    (state) => state.setShortcutRecording,
  );
  const licenseOpen = useMainWindowStore((state) => state.licenseOpen);
  const setLicenseOpen = useMainWindowStore((state) => state.setLicenseOpen);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticFeedback, setDiagnosticFeedback] = useState<string | null>(
    null,
  );
  const [confirming, setConfirming] = useState<IntegrationItemDto | null>(null);

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
      className={
        compact ? "settings-page onboarding-settings" : "settings-page"
      }
    >
      {compact === undefined && (
        <header className="settings-titlebar" data-tauri-drag-region>
          <IconButton
            icon={ArrowLeft}
            label={t("actions.back", { ns: "common" })}
            onClick={onBack}
          />
          <h1>{t("title")}</h1>
        </header>
      )}
      <div className="settings-scroll">
        {compact !== "codingAgents" && (
          <SettingsSection title={t("sections.general")}>
            {compact === undefined && (
              <SettingRow
                label={t("language.label")}
                description={t("language.description")}
              >
                <select
                  aria-label={t("language.label")}
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
              <button
                className="text-button"
                disabled={setShortcut.isPending}
                onClick={() =>
                  void changeShortcut({
                    modifiers: ["command", "shift"],
                    key: "Space",
                    display: "⌘⇧Space",
                  })
                }
                type="button"
              >
                {t("shortcut.restoreDefault")}
              </button>
            </SettingRow>
            <SettingRow
              label={t("launchAtLogin.label")}
              description={
                settings.data?.debugProfile
                  ? t("launchAtLogin.isolated")
                  : t("launchAtLogin.description")
              }
            >
              <label className="switch-control">
                <input
                  checked={settings.data?.launchAtLogin ?? false}
                  disabled={
                    settings.data === undefined ||
                    !settings.data.launchAtLoginAvailable ||
                    setLaunch.isPending
                  }
                  onChange={(event) => {
                    setError(null);
                    void setLaunch
                      .mutateAsync(event.target.checked)
                      .catch((cause: unknown) =>
                        setError(localizedError(cause)),
                      );
                  }}
                  type="checkbox"
                />
                <span aria-hidden="true" />
              </label>
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
                <span className="setting-value">
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
                  <span className="setting-feedback" role="status">
                    {diagnosticFeedback}
                  </span>
                )}
                <button onClick={() => void copyDiagnostics()} type="button">
                  {t("about.copyDiagnostics")}
                </button>
                <button onClick={() => void revealLogs()} type="button">
                  {t("about.revealLogs")}
                </button>
              </SettingRow>
              <SettingRow
                label={t("about.license")}
                description={t("about.licenseDescription")}
              >
                <button onClick={() => setLicenseOpen(true)} type="button">
                  {t("about.viewLicense")}
                </button>
              </SettingRow>
            </SettingsSection>
          </>
        )}

        {(error !== null || settings.isError || integrations.isError) && (
          <p className="settings-error" role="alert">
            <Warning aria-hidden="true" size={14} />
            {error ?? localizedError(settings.error ?? integrations.error)}
          </p>
        )}
      </div>

      {confirming !== null && (
        <div
          aria-labelledby="integration-confirm-title"
          aria-modal="true"
          className="modal-scrim"
          role="alertdialog"
        >
          <div className="compact-dialog">
            <h2 id="integration-confirm-title">
              {t("integration.confirmUninstall", {
                name: integrationName(confirming.id),
              })}
            </h2>
            <p>{t("integration.removeManaged")}</p>
            <code>{confirming.path}</code>
            <div className="dialog-actions">
              <button
                autoFocus
                onClick={() => setConfirming(null)}
                type="button"
              >
                {t("actions.cancel", { ns: "common" })}
              </button>
              <button
                className="danger-button"
                onClick={() => void runIntegration(confirming, "uninstall")}
                type="button"
              >
                {t("actions.uninstall", { ns: "common" })}
              </button>
            </div>
          </div>
        </div>
      )}

      {licenseOpen && settings.data !== undefined && (
        <div
          aria-labelledby="license-title"
          aria-modal="true"
          className="modal-scrim"
          role="dialog"
        >
          <div className="license-dialog">
            <header>
              <h2 id="license-title">{t("about.licenseTitle")}</h2>
              <IconButton
                icon={X}
                label={t("about.closeLicense")}
                onClick={() => setLicenseOpen(false)}
              />
            </header>
            <pre>{settings.data.licenseText}</pre>
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
    <section className="settings-section">
      <h2>{title}</h2>
      <div className="settings-section-body">{children}</div>
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
    <div className="setting-row">
      <div className="setting-copy">
        <strong>{label}</strong>
        <span>{description}</span>
      </div>
      <div className="setting-actions">{children}</div>
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
    <div className="shortcut-control">
      <button
        aria-pressed={recording}
        className={
          recording ? "shortcut-recorder recording" : "shortcut-recorder"
        }
        onClick={startRecording}
        onKeyDown={handleKeyDown}
        type="button"
      >
        <Command aria-hidden="true" size={14} />
        {recording ? t("shortcut.recording") : shortcut.display}
      </button>
      {error !== null && <span className="inline-warning">{error}</span>}
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
    <div className="setting-row integration-row">
      <div className="integration-icon">
        {id === "cli" ? (
          <TerminalWindow size={15} />
        ) : id === "codex" ? (
          <Copy size={15} />
        ) : (
          <Command size={15} />
        )}
      </div>
      <div className="setting-copy">
        <strong>{integrationName(id)}</strong>
        <span>
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
        className={
          needsAttention ? "integration-status attention" : "integration-status"
        }
      >
        {installed ? (
          <Check size={13} />
        ) : needsAttention ? (
          <Warning size={13} />
        ) : null}
        {installed
          ? t("integration.installed", { ns: "settings" })
          : needsAttention
            ? t("integration.needsAttention", { ns: "settings" })
            : t("integration.notInstalled", { ns: "settings" })}
      </span>
      <button
        disabled={item === undefined || pending}
        onClick={() => item !== undefined && onAction(item, action)}
        type="button"
      >
        {label}
      </button>
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
