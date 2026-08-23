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

import {
  useIntegrationMutation,
  useIntegrationsQuery,
  useSetGlobalShortcutMutation,
  useSetLaunchAtLoginMutation,
  useSettingsQuery,
} from "../data/queries";
import type {
  IntegrationId,
  IntegrationItemDto,
  ShortcutModifier,
  ShortcutSpecDto,
} from "../../shared/tauri/types";
import { revealPath } from "../../shared/tauri/commands";
import { IconButton } from "../../shared/ui/icon-button";
import { useMainWindowStore } from "../../store/main-window";

interface SettingsPageProps {
  onBack: () => void;
  compact?: "quickCapture" | "codingAgents";
}

export function SettingsPage({ onBack, compact }: SettingsPageProps) {
  const settings = useSettingsQuery();
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
      setError(toMessage(cause));
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
      setError(toMessage(cause));
    }
  }

  async function revealIntegration(item: IntegrationItemDto): Promise<void> {
    setError(null);
    try {
      await revealPath(item.path);
    } catch (cause) {
      setError(toMessage(cause));
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
          <IconButton icon={ArrowLeft} label="Back" onClick={onBack} />
          <h1>Settings</h1>
        </header>
      )}
      <div className="settings-scroll">
        {compact !== "codingAgents" && (
          <SettingsSection title="General">
            <SettingRow
              label="Shortcut"
              description="Open Quick Capture from any app."
            >
              {settings.data !== undefined && (
                <ShortcutRecorder
                  error={
                    settings.data.shortcutRegistration === "conflict"
                      ? "Shortcut is currently unavailable"
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
                Restore Default
              </button>
            </SettingRow>
            <SettingRow
              label="Launch at Login"
              description="Start Sidequest hidden and keep Quick Capture available."
            >
              <label className="switch-control">
                <input
                  checked={settings.data?.launchAtLogin ?? false}
                  disabled={settings.data === undefined || setLaunch.isPending}
                  onChange={(event) => {
                    setError(null);
                    void setLaunch
                      .mutateAsync(event.target.checked)
                      .catch((cause: unknown) => setError(toMessage(cause)));
                  }}
                  type="checkbox"
                />
                <span aria-hidden="true" />
              </label>
            </SettingRow>
          </SettingsSection>
        )}

        {compact !== "quickCapture" && (
          <SettingsSection title="Coding Agents">
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
          <SettingsSection title="Command Line Tool">
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
            <SettingsSection title="Command Line Tool">
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
            <SettingsSection title="About">
              <SettingRow label="Sidequest" description="Desktop application">
                <span className="setting-value">
                  Version {settings.data?.appVersion ?? "—"}
                </span>
              </SettingRow>
              <SettingRow
                label="Check for Updates"
                description="Available in Stage 8."
              >
                <button disabled type="button">
                  Check
                </button>
              </SettingRow>
              <SettingRow
                label="License"
                description="Sidequest is released under the MIT License."
              >
                <button onClick={() => setLicenseOpen(true)} type="button">
                  View License
                </button>
              </SettingRow>
            </SettingsSection>
          </>
        )}

        {(error !== null || settings.isError || integrations.isError) && (
          <p className="settings-error" role="alert">
            <Warning aria-hidden="true" size={14} />
            {error ?? toMessage(settings.error ?? integrations.error)}
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
              Uninstall {integrationName(confirming.id)}?
            </h2>
            <p>Sidequest will remove the managed file at:</p>
            <code>{confirming.path}</code>
            <div className="dialog-actions">
              <button
                autoFocus
                onClick={() => setConfirming(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="danger-button"
                onClick={() => void runIntegration(confirming, "uninstall")}
                type="button"
              >
                Uninstall
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
              <h2 id="license-title">MIT License</h2>
              <IconButton
                icon={X}
                label="Close license"
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
        {recording ? "Type shortcut…" : shortcut.display}
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
    ? "Uninstall"
    : blocked
      ? "Reveal"
      : item?.state === "updateAvailable"
        ? "Update"
        : item?.state === "repairRequired"
          ? "Repair"
          : "Install";
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
        <span>{item?.message ?? item?.path ?? "Loading…"}</span>
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
          ? "Installed"
          : needsAttention
            ? "Needs Attention"
            : "Not Installed"}
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

function toMessage(value: unknown): string {
  return value instanceof Error
    ? value.message
    : String(value ?? "Unknown error");
}
