import {
  ArrowLeft,
  Blocks,
  Check,
  Command,
  Copy,
  Info,
  SlidersHorizontal,
  SquareTerminal,
  TriangleAlert,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  useLocaleSettingsQuery,
  useSetGlobalShortcutMutation,
  useSetLaunchAtLoginMutation,
  useSetLocalePreferenceMutation,
  useSetThemePreferenceMutation,
  useSettingsQuery,
  useThemeSettingsQuery,
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
  ThemePreference,
} from "../../shared/tauri/types";
import {
  copyDiagnosticReport,
  revealDiagnosticLogs,
  revealPath,
} from "../../shared/tauri/commands";
import { localizedError } from "../../shared/i18n/errors";
import { cn } from "../../shared/lib/utils";
import { Button } from "../../shared/ui/button";
import { IconButton } from "../../shared/ui/icon-button";
import { Switch } from "../../shared/ui/switch";

interface SettingsPageProps {
  onBack: () => void;
  compact?: "quickCapture" | "codingAgents";
}

type SettingsSectionId = "general" | "integrations" | "tools" | "about";

const SUCCESS_TOAST_DURATION = 3_000;
const ERROR_TOAST_DURATION = 8_000;

const SETTINGS_SECTIONS: Array<{
  id: SettingsSectionId;
  icon: LucideIcon;
  labelKey:
    | "sections.general"
    | "sections.integrations"
    | "sections.tools"
    | "sections.about";
}> = [
  { id: "general", icon: SlidersHorizontal, labelKey: "sections.general" },
  { id: "integrations", icon: Blocks, labelKey: "sections.integrations" },
  { id: "tools", icon: Wrench, labelKey: "sections.tools" },
  { id: "about", icon: Info, labelKey: "sections.about" },
];

export function SettingsPage({ onBack, compact }: SettingsPageProps) {
  const { t } = useTranslation(["settings", "common", "errors"]);
  const settings = useSettingsQuery();
  const localeSettings = useLocaleSettingsQuery();
  const themeSettings = useThemeSettingsQuery();
  const integrations = useIntegrationsQuery();
  const setLocale = useSetLocalePreferenceMutation();
  const setTheme = useSetThemePreferenceMutation();
  const setShortcut = useSetGlobalShortcutMutation();
  const setLaunch = useSetLaunchAtLoginMutation();
  const integrationMutation = useIntegrationMutation();
  const [activeSection, setActiveSection] =
    useState<SettingsSectionId>("general");
  const [recording, setRecording] = useState(false);
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [confirming, setConfirming] = useState<IntegrationItemDto | null>(null);

  useEffect(() => {
    if (compact === undefined) {
      void settings.refetch();
      void integrations.refetch();
    }
  }, [compact]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (settings.error !== null) {
      showError(localizedError(settings.error), "settings-load-error");
    }
  }, [settings.error]);

  useEffect(() => {
    if (localeSettings.error !== null) {
      showError(localizedError(localeSettings.error), "locale-load-error");
    }
  }, [localeSettings.error]);

  useEffect(() => {
    if (themeSettings.error !== null) {
      showError(localizedError(themeSettings.error), "theme-load-error");
    }
  }, [themeSettings.error]);

  useEffect(() => {
    if (integrations.error !== null) {
      showError(localizedError(integrations.error), "integrations-load-error");
    }
  }, [integrations.error]);

  function selectSection(section: SettingsSectionId): void {
    if (section === activeSection) return;
    setRecording(false);
    setActiveSection(section);
  }

  async function changeShortcut(shortcut: ShortcutSpecDto): Promise<void> {
    try {
      await setShortcut.mutateAsync(shortcut);
      setRecording(false);
    } catch (cause) {
      showError(localizedError(cause), "shortcut-save-error");
    }
  }

  async function runIntegration(
    item: IntegrationItemDto,
    action: "install" | "uninstall",
  ): Promise<void> {
    try {
      await integrationMutation.mutateAsync({ id: item.id, action });
      setConfirming(null);
    } catch (cause) {
      showError(localizedError(cause), `integration-${item.id}-error`);
    }
  }

  async function revealIntegration(item: IntegrationItemDto): Promise<void> {
    try {
      await revealPath(item.path);
    } catch (cause) {
      showError(localizedError(cause), `integration-${item.id}-reveal-error`);
    }
  }

  async function copyDiagnostics(): Promise<void> {
    try {
      await copyDiagnosticReport();
      toast.success(t("feedback.copied", { ns: "common" }), {
        duration: SUCCESS_TOAST_DURATION,
        id: "diagnostics-copied",
      });
    } catch (cause) {
      showError(localizedError(cause), "diagnostics-copy-error");
    }
  }

  async function revealLogs(): Promise<void> {
    try {
      await revealDiagnosticLogs();
      toast.success(t("feedback.revealedInFinder", { ns: "common" }), {
        duration: SUCCESS_TOAST_DURATION,
        id: "logs-revealed",
      });
    } catch (cause) {
      showError(localizedError(cause), "logs-reveal-error");
    }
  }

  function handleIntegrationAction(
    item: IntegrationItemDto,
    action: "install" | "uninstall" | "reveal",
  ): void {
    if (action === "reveal") {
      void revealIntegration(item);
    } else if (action === "uninstall") {
      setConfirming(item);
    } else {
      void runIntegration(item, action);
    }
  }

  const generalRows = (
    <>
      {compact === undefined ? (
        <SettingRow
          description={t("appearance.description")}
          label={t("appearance.label")}
        >
          <ThemePreferenceControl
            disabled={themeSettings.data === undefined || setTheme.isPending}
            onChange={(preference) => {
              void setTheme.mutateAsync(preference).catch((cause: unknown) => {
                showError(localizedError(cause), "theme-save-error");
              });
            }}
            value={themeSettings.data?.preference ?? "system"}
          />
        </SettingRow>
      ) : null}
      {compact === undefined ? (
        <SettingRow
          description={t("language.description")}
          label={t("language.label")}
        >
          <select
            aria-label={t("language.label")}
            className="h-8 rounded-md border border-input bg-surface px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={localeSettings.data === undefined || setLocale.isPending}
            value={localeSettings.data?.preference ?? "system"}
            onChange={(event) => {
              void setLocale
                .mutateAsync(event.target.value as LanguagePreference)
                .catch(() => {
                  showError(
                    t("languageSaveFailed", { ns: "errors" }),
                    "language-save-error",
                  );
                });
            }}
          >
            <option value="system">{t("language.system")}</option>
            <option value="en">{t("language.english")}</option>
            <option value="zh-CN">{t("language.simplifiedChinese")}</option>
          </select>
        </SettingRow>
      ) : null}
      <SettingRow
        description={t("shortcut.description")}
        label={t("shortcut.label")}
      >
        {settings.data !== undefined ? (
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
        ) : null}
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
        description={
          settings.data?.debugProfile
            ? t("launchAtLogin.isolated")
            : t("launchAtLogin.description")
        }
        label={t("launchAtLogin.label")}
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
            void setLaunch.mutateAsync(checked).catch((cause: unknown) => {
              showError(localizedError(cause), "launch-at-login-save-error");
            });
          }}
        />
      </SettingRow>
    </>
  );

  const integrationRows = (["codex", "claude"] as const).map((id) => (
    <IntegrationRow
      item={integrations.data?.find((item) => item.id === id)}
      key={id}
      onAction={handleIntegrationAction}
      pending={
        integrationMutation.isPending &&
        integrationMutation.variables?.id === id
      }
    />
  ));

  const toolRows = (
    <IntegrationRow
      item={integrations.data?.find((item) => item.id === "cli")}
      onAction={handleIntegrationAction}
      pending={
        integrationMutation.isPending &&
        integrationMutation.variables?.id === "cli"
      }
    />
  );

  const aboutRows = (
    <>
      <SettingRow description={t("about.application")} label="Sidequest">
        <span className="max-w-full overflow-hidden text-ellipsis text-[11px] leading-4 text-muted-foreground">
          {t("about.version", {
            version: settings.data?.appVersion ?? "—",
          })}
        </span>
      </SettingRow>
      <SettingRow
        description={t("about.diagnosticsDescription")}
        label={t("about.diagnostics")}
      >
        <Button
          onClick={() => void copyDiagnostics()}
          size="sm"
          variant="outline"
        >
          {t("about.copyDiagnostics")}
        </Button>
        <Button onClick={() => void revealLogs()} size="sm" variant="outline">
          {t("about.revealLogs")}
        </Button>
      </SettingRow>
      <SettingRow
        description={t("about.licenseDescription")}
        label={t("about.license")}
      >
        <Button
          onClick={() => setLicenseOpen(true)}
          size="sm"
          variant="outline"
        >
          {t("about.viewLicense")}
        </Button>
      </SettingRow>
    </>
  );

  function activeRows(): ReactNode {
    if (activeSection === "general") return generalRows;
    if (activeSection === "integrations") return integrationRows;
    if (activeSection === "tools") return toolRows;
    return aboutRows;
  }

  return (
    <section
      className={cn(
        "relative flex min-h-0 min-w-0 bg-workspace",
        compact ? "mt-3 w-full flex-none bg-transparent" : "h-full flex-1",
      )}
    >
      {compact !== undefined ? (
        <div className="w-full">
          {compact === "quickCapture" ? (
            <>
              <SettingsSection title={t("sections.general")}>
                {generalRows}
              </SettingsSection>
              <SettingsSection title={t("sections.commandLine")}>
                {toolRows}
              </SettingsSection>
            </>
          ) : (
            <SettingsSection title={t("sections.codingAgents")}>
              {integrationRows}
            </SettingsSection>
          )}
        </div>
      ) : (
        <>
          <aside className="flex w-[216px] shrink-0 flex-col border-r bg-sidebar">
            <div
              className="flex h-12 shrink-0 items-center pl-[76px] pr-2"
              data-tauri-drag-region="deep"
            >
              <Button
                data-tauri-drag-region="false"
                onClick={onBack}
                size="sm"
                variant="ghost"
              >
                <ArrowLeft aria-hidden="true" size={15} />
                {t("actions.back", { ns: "common" })}
              </Button>
            </div>
            <nav
              aria-label={t("title")}
              className="flex flex-col gap-1 px-2 pt-3"
            >
              {SETTINGS_SECTIONS.map((section) => {
                const Icon = section.icon;
                const selected = activeSection === section.id;
                return (
                  <button
                    aria-current={selected ? "page" : undefined}
                    className={cn(
                      "flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] font-medium text-muted-foreground outline-none transition-[color,background-color,box-shadow] duration-[var(--motion-fast)] hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring",
                      selected && "bg-accent text-foreground",
                    )}
                    key={section.id}
                    onClick={() => selectSection(section.id)}
                    type="button"
                  >
                    <Icon aria-hidden="true" size={15} strokeWidth={1.8} />
                    {t(section.labelKey)}
                  </button>
                );
              })}
            </nav>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col bg-workspace">
            <header
              className="flex h-12 shrink-0 items-center border-b px-7"
              data-tauri-drag-region="deep"
            >
              <h1 className="text-sm font-semibold">
                {t(
                  SETTINGS_SECTIONS.find(
                    (section) => section.id === activeSection,
                  )?.labelKey ?? "sections.general",
                )}
              </h1>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="w-full max-w-[760px] px-7 pb-12 pt-6">
                <SettingsSection>{activeRows()}</SettingsSection>
              </div>
            </div>
          </div>
        </>
      )}

      {confirming !== null ? (
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
      ) : null}

      {licenseOpen && settings.data !== undefined ? (
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
      ) : null}
    </section>
  );
}

function showError(message: string, id: string): void {
  toast.error(message, { duration: ERROR_TOAST_DURATION, id });
}

function SettingsSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-[26px] w-full">
      {title !== undefined ? (
        <h2 className="mb-2 text-xs font-semibold text-muted-foreground">
          {title}
        </h2>
      ) : null}
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
    <div className="flex min-h-[58px] flex-wrap items-center gap-3 border-b px-0.5 py-2.5">
      <div className="flex min-w-[260px] flex-1 flex-col gap-px">
        <strong className="text-[13px] font-medium">{label}</strong>
        <span className="text-pretty text-[11px] leading-4 text-muted-foreground">
          {description}
        </span>
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        {children}
      </div>
    </div>
  );
}

function ThemePreferenceControl({
  value,
  disabled,
  onChange,
}: {
  value: ThemePreference;
  disabled: boolean;
  onChange: (preference: ThemePreference) => void;
}) {
  const { t } = useTranslation("settings");
  const options: ThemePreference[] = ["system", "light", "dark"];
  return (
    <div
      aria-label={t("appearance.label")}
      className="inline-flex rounded-md border border-input bg-surface p-0.5 shadow-control"
      role="radiogroup"
    >
      {options.map((option) => (
        <Button
          aria-checked={value === option}
          className={cn(
            "h-7 min-w-[64px] px-2 shadow-none",
            value === option && "bg-accent text-accent-foreground",
          )}
          disabled={disabled}
          key={option}
          onClick={() => onChange(option)}
          role="radio"
          size="sm"
          variant="ghost"
        >
          {t(`appearance.${option}`)}
        </Button>
      ))}
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
      {error !== null ? (
        <span className="text-[11px] text-destructive">{error}</span>
      ) : null}
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
    <div className="flex min-h-[52px] flex-wrap items-center gap-3 border-b px-0.5 py-2.5">
      <div className="inline-flex size-[26px] items-center justify-center rounded-md border bg-elevated text-muted-foreground">
        {id === "cli" ? (
          <SquareTerminal aria-hidden="true" size={15} />
        ) : id === "codex" ? (
          <Copy aria-hidden="true" size={15} />
        ) : (
          <Command aria-hidden="true" size={15} />
        )}
      </div>
      <div className="flex min-w-[180px] flex-1 flex-col gap-px">
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
          <Check aria-hidden="true" size={13} />
        ) : needsAttention ? (
          <TriangleAlert aria-hidden="true" size={13} />
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
