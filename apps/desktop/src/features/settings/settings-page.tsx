import {
  ArrowLeft,
  Blocks,
  Check,
  Command,
  Copy,
  Info,
  Keyboard,
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
import { ShortcutHint } from "../../shared/ui/shortcut-hint";
import { Switch } from "../../shared/ui/switch";

interface SettingsPageProps {
  onBack: () => void;
  compact?: "quickCapture" | "codingAgents" | "onboardingIntegrations";
}

type SettingsSectionId =
  "general" | "shortcuts" | "integrations" | "tools" | "about";

const SUCCESS_TOAST_DURATION = 3_000;
const ERROR_TOAST_DURATION = 8_000;

const SETTINGS_SECTIONS: Array<{
  id: SettingsSectionId;
  icon: LucideIcon;
  labelKey:
    | "sections.general"
    | "sections.shortcuts"
    | "sections.integrations"
    | "sections.tools"
    | "sections.about";
}> = [
  { id: "general", icon: SlidersHorizontal, labelKey: "sections.general" },
  { id: "shortcuts", icon: Keyboard, labelKey: "sections.shortcuts" },
  { id: "integrations", icon: Blocks, labelKey: "sections.integrations" },
  { id: "tools", icon: Wrench, labelKey: "sections.tools" },
  { id: "about", icon: Info, labelKey: "sections.about" },
];

const SETTINGS_NAV_ITEM_CLASS =
  "flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] font-medium text-muted-foreground outline-none transition-[color,background-color,box-shadow] duration-[var(--motion-fast)] hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring";

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

  const shortcutReference = (
    <>
      <SettingsSection title={t("shortcutReference.groups.global")}>
        <ShortcutReferenceRow
          description={t("shortcutReference.quickCapture.description")}
          shortcut={settings.data?.shortcut.display ?? "—"}
          label={t("shortcutReference.quickCapture.label")}
        />
        <ShortcutReferenceRow
          shortcut="⌘ ,"
          label={t("shortcutReference.openSettings")}
        />
        <ShortcutReferenceRow
          shortcut="⌘Q"
          label={t("shortcutReference.quit")}
        />
      </SettingsSection>
      <SettingsSection title={t("shortcutReference.groups.mainWindow")}>
        <ShortcutReferenceRow
          shortcut="⌘F"
          label={t("shortcutReference.focusSearch")}
        />
        <ShortcutReferenceRow
          description={t("shortcutReference.dismissMainWindow.description")}
          shortcut="Esc"
          label={t("shortcutReference.dismissMainWindow.label")}
        />
        <ShortcutReferenceRow
          description={t("shortcutReference.saveQuest.description")}
          shortcut="⌘S"
          label={t("shortcutReference.saveQuest.label")}
        />
        <ShortcutReferenceRow
          shortcut="Esc"
          label={t("shortcutReference.closeQuestDetails")}
        />
      </SettingsSection>
      <SettingsSection title={t("shortcutReference.groups.quickCapture")}>
        <ShortcutReferenceRow
          shortcut="⌘↵"
          label={t("shortcutReference.submitQuickCapture")}
        />
        <ShortcutReferenceRow
          description={t("shortcutReference.discardQuickCapture.description")}
          shortcut="Esc"
          label={t("shortcutReference.discardQuickCapture.label")}
        />
      </SettingsSection>
      <SettingsSection title={t("shortcutReference.groups.settings")}>
        <ShortcutReferenceRow
          shortcut="Esc"
          label={t("shortcutReference.cancelRecording")}
        />
      </SettingsSection>
    </>
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

  function activeContent(): ReactNode {
    if (activeSection === "shortcuts") return shortcutReference;
    const rows =
      activeSection === "general"
        ? generalRows
        : activeSection === "integrations"
          ? integrationRows
          : activeSection === "tools"
            ? toolRows
            : aboutRows;
    return <SettingsSection>{rows}</SettingsSection>;
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
          ) : compact === "onboardingIntegrations" ? (
            <>
              <SettingsSection title={t("sections.commandLine")}>
                {toolRows}
              </SettingsSection>
              <SettingsSection title={t("sections.agentSkillsSetup")}>
                {integrationRows}
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
            <div className="h-12 shrink-0" data-tauri-drag-region="deep" />
            <div className="px-2 pt-2">
              <button
                className={SETTINGS_NAV_ITEM_CLASS}
                onClick={onBack}
                type="button"
              >
                <ArrowLeft aria-hidden="true" size={15} />
                {t("actions.back", { ns: "common" })}
              </button>
              <h2
                className="mb-1.5 mt-5 px-2.5 text-[11px] font-semibold text-muted-foreground"
                id="settings-navigation-title"
              >
                {t("title")}
              </h2>
            </div>
            <nav
              aria-labelledby="settings-navigation-title"
              className="flex flex-col gap-1 px-2"
            >
              {SETTINGS_SECTIONS.map((section) => {
                const Icon = section.icon;
                const selected = activeSection === section.id;
                return (
                  <button
                    aria-current={selected ? "page" : undefined}
                    className={cn(
                      SETTINGS_NAV_ITEM_CLASS,
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
              <div className="w-full px-7 pb-12 pt-6">{activeContent()}</div>
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
    <section className="mb-8 w-full">
      {title !== undefined ? (
        <h2 className="mb-2.5 px-1 text-xs font-semibold text-muted-foreground">
          {title}
        </h2>
      ) : null}
      <div className="flex flex-col gap-2">{children}</div>
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
    <div className="grid min-h-[68px] grid-cols-[minmax(260px,1fr)_auto] items-center gap-x-8 gap-y-3 rounded-lg bg-surface/45 px-4 py-3.5">
      <div className="flex min-w-0 flex-col gap-1">
        <strong className="text-[13px] font-semibold leading-[18px]">
          {label}
        </strong>
        <span className="max-w-[46ch] text-pretty text-xs leading-[18px] text-muted-foreground">
          {description}
        </span>
      </div>
      <div className="flex min-w-[240px] flex-wrap items-center justify-end gap-2">
        {children}
      </div>
    </div>
  );
}

function ShortcutReferenceRow({
  label,
  description,
  shortcut,
}: {
  label: string;
  description?: string;
  shortcut: string;
}) {
  return (
    <div className="grid min-h-[60px] grid-cols-[minmax(260px,1fr)_auto] items-center gap-x-8 gap-y-3 rounded-lg bg-surface/45 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[13px] font-medium leading-[18px]">{label}</span>
        {description === undefined ? null : (
          <span className="max-w-[52ch] text-pretty text-xs leading-[18px] text-muted-foreground">
            {description}
          </span>
        )}
      </div>
      <div className="flex items-center justify-end">
        <ShortcutHint shortcut={shortcut} />
        <span className="sr-only">{shortcut}</span>
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
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!recording) return;

    function cancelRecording(event: globalThis.KeyboardEvent): void {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setValidationError(null);
      onCancel();
    }

    window.addEventListener("keydown", cancelRecording, { capture: true });
    return () =>
      window.removeEventListener("keydown", cancelRecording, {
        capture: true,
      });
  }, [onCancel, recording]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      setValidationError(null);
      onCancel();
      return;
    }
    if (["Meta", "Control", "Alt", "Shift"].includes(event.key)) return;

    const modifiers: ShortcutModifier[] = [];
    if (event.metaKey) modifiers.push("command");
    if (event.ctrlKey) modifiers.push("control");
    if (event.altKey) modifiers.push("option");
    if (event.shiftKey) modifiers.push("shift");

    if (
      !modifiers.some((modifier) =>
        ["command", "control", "option"].includes(modifier),
      )
    ) {
      setValidationError(t("shortcut.modifierRequired"));
      return;
    }

    const key = shortcutKeyFromEvent(event);
    if (key === null) {
      setValidationError(t("shortcut.unsupportedKey"));
      return;
    }

    setValidationError(null);
    onRecord({
      modifiers,
      key,
      display: shortcutDisplay(modifiers, key),
    });
  }
  return (
    <div className="flex flex-col items-end">
      <Button
        aria-pressed={recording}
        className={cn("min-w-[116px]", recording && "ring-2 ring-ring")}
        onClick={() => {
          setValidationError(null);
          startRecording();
        }}
        onKeyDown={handleKeyDown}
        variant="outline"
      >
        {recording ? (
          t("shortcut.recording")
        ) : (
          <>
            <ShortcutHint shortcut={shortcut.display} />
            <span className="sr-only">{shortcut.display}</span>
          </>
        )}
      </Button>
      {validationError !== null || error !== null ? (
        <span className="max-w-[240px] text-right text-[11px] leading-4 text-destructive">
          {validationError ?? error}
        </span>
      ) : null}
    </div>
  );
}

function shortcutKeyFromEvent(
  event: KeyboardEvent<HTMLButtonElement>,
): string | null {
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3);
  if (/^Digit[0-9]$/.test(event.code)) return event.code.slice(5);
  if (event.code === "Space") return "Space";
  if (/^Arrow(Up|Down|Left|Right)$/.test(event.code)) return event.code;
  if (/^F([1-9]|1[0-2])$/.test(event.code)) return event.code;

  if (/^[a-z0-9]$/i.test(event.key)) return event.key.toUpperCase();
  return null;
}

function shortcutDisplay(modifiers: ShortcutModifier[], key: string): string {
  const modifierDisplay: Record<ShortcutModifier, string> = {
    command: "⌘",
    control: "⌃",
    option: "⌥",
    shift: "⇧",
  };
  const keyDisplay: Record<string, string> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
  };
  return `${modifiers.map((modifier) => modifierDisplay[modifier]).join("")}${keyDisplay[key] ?? key}`;
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
  const description =
    item === undefined
      ? t("integration.loading", { ns: "settings" })
      : id === "cli"
        ? integrationDescription(
            item,
            t("integration.installed", { ns: "settings" }),
            t("integration.notInstalled", { ns: "settings" }),
            t("integration.needsAttention", { ns: "settings" }),
          )
        : item.state === "installed"
          ? t("integration.agentSkillInstalled")
          : item.state === "notInstalled"
            ? t("integration.agentSkillNotInstalled")
            : t("integration.agentSkillNeedsAttention");
  return (
    <div className="grid min-h-[64px] grid-cols-[auto_minmax(180px,1fr)_auto_auto] items-center gap-x-3 gap-y-2 rounded-lg bg-surface/45 px-4 py-3">
      <div className="inline-flex size-8 items-center justify-center rounded-md bg-background/45 text-muted-foreground">
        {id === "cli" ? (
          <SquareTerminal aria-hidden="true" size={15} />
        ) : id === "codex" ? (
          <Copy aria-hidden="true" size={15} />
        ) : (
          <Command aria-hidden="true" size={15} />
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <strong className="text-[13px] font-semibold leading-[18px]">
          {integrationName(id)}
        </strong>
        <span className="overflow-hidden text-ellipsis text-xs leading-[18px] text-muted-foreground">
          {description}
        </span>
      </div>
      <span
        className={cn(
          "inline-flex min-w-[88px] items-center justify-end gap-1.5 text-xs text-muted-foreground",
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
