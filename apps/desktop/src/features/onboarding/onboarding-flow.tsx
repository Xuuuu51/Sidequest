import { Check, FolderOpen, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

import sidequestLogo from "../../../src-tauri/icons/128x128.png";
import { useSetOnboardingStepMutation } from "./data";
import { SettingsPage } from "../settings/settings-page";
import { useSettingsQuery } from "../settings/data";
import type { AppStateDto } from "../../shared/tauri/types";
import { Button } from "../../shared/ui/button";
import { ShortcutHint } from "../../shared/ui/shortcut-hint";

interface OnboardingFlowProps {
  appState: AppStateDto;
  addPending: boolean;
  error: string | null;
  onAddProject: () => void;
}

export function OnboardingFlow({
  appState,
  addPending,
  error,
  onAddProject,
}: OnboardingFlowProps) {
  const { t } = useTranslation("onboarding");
  const settings = useSettingsQuery();
  const completeOnboarding = useSetOnboardingStepMutation();
  const selectedProject =
    appState.projects.find(
      (project) => project.path === appState.lastSelectedProject,
    ) ?? appState.projects[0];
  const hasProject = selectedProject !== undefined;
  const shortcut = settings.data?.shortcut.display ?? "⌘⇧Space";

  return (
    <main className="relative h-full min-h-0 w-full overflow-hidden bg-background text-foreground">
      <div
        className="absolute inset-x-0 top-0 z-10 h-12"
        data-tauri-drag-region="deep"
      />

      <div className="absolute right-7 top-5 z-20 flex items-center gap-2.5">
        <img
          alt=""
          aria-hidden="true"
          className="size-8 rounded-[9px] shadow-control"
          src={sidequestLogo}
        />
        <span className="text-sm font-semibold tracking-[-0.01em]">
          {t("brand")}
        </span>
      </div>

      <div className="mx-auto grid h-full w-full max-w-[1240px] grid-cols-[1.15fr_0.85fr] px-12 pb-10 pt-20">
        <section
          aria-labelledby="onboarding-title"
          className="flex min-h-0 flex-col justify-center pr-16"
        >
          <div className="max-w-[560px]">
            <h1
              className="max-w-[18ch] text-[32px] font-semibold leading-[1.12] tracking-[-0.025em] text-balance"
              id="onboarding-title"
            >
              {t("welcome.title")}
            </h1>
            <p className="mt-4 max-w-[56ch] text-pretty text-[13px] leading-5 text-muted-foreground">
              {t("welcome.description")}
            </p>

            <div className="mt-8">
              {hasProject ? (
                <div className="flex items-start gap-3 border-l-2 border-brand pl-4">
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-subtle text-brand-foreground">
                    <Check aria-hidden="true" size={16} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold leading-5">
                      {t("addProject.ready", { name: selectedProject.name })}
                    </h2>
                    <p className="mt-1 max-w-[42ch] text-xs leading-[18px] text-muted-foreground">
                      {t("addProject.readyDescription")}
                    </p>
                  </div>
                </div>
              ) : null}

              {error !== null ? (
                <p className="mt-3 text-xs text-destructive" role="alert">
                  {error}
                </p>
              ) : null}

              <div
                className={`flex flex-wrap items-center gap-2.5 ${hasProject ? "mt-5" : "mt-0"}`}
              >
                {hasProject ? (
                  <Button
                    disabled={completeOnboarding.isPending}
                    onClick={() =>
                      void completeOnboarding.mutateAsync("complete")
                    }
                    size="lg"
                  >
                    {t("finish.action")}
                  </Button>
                ) : (
                  <Button
                    disabled={addPending}
                    onClick={onAddProject}
                    size="lg"
                  >
                    <FolderOpen aria-hidden="true" size={15} />
                    {addPending
                      ? t("addProject.adding")
                      : t("addProject.chooseFolder")}
                  </Button>
                )}
              </div>
            </div>

            <aside className="mt-10 flex items-start gap-3 border-t pt-5">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-surface text-brand-foreground shadow-control">
                <Zap aria-hidden="true" size={15} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h2 className="text-[13px] font-semibold">
                    {t("quickCapture.title")}
                  </h2>
                  <ShortcutHint shortcut={shortcut} />
                </div>
                <p className="mt-1 max-w-[45ch] text-xs leading-[18px] text-muted-foreground">
                  {t("quickCapture.description")}
                </p>
              </div>
            </aside>
          </div>
        </section>

        <section
          aria-labelledby="onboarding-tools-title"
          className="flex min-h-0 flex-col justify-center border-l pl-12"
        >
          <div className="max-w-[480px]">
            <h2
              className="text-lg font-semibold tracking-[-0.01em]"
              id="onboarding-tools-title"
            >
              {t("tools.title")}
            </h2>
            <p className="mt-2 max-w-[58ch] text-pretty text-xs leading-[18px] text-muted-foreground">
              {t("tools.description")}
            </p>
            <SettingsPage
              compact="onboardingIntegrations"
              onBack={() => undefined}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
