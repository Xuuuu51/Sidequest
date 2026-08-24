import { Bot, Check, FolderOpen, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useSetOnboardingStepMutation } from "./data";
import { SettingsPage } from "../settings/settings-page";
import type { AppStateDto } from "../../shared/tauri/types";
import { Button } from "../../shared/ui/button";

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
  const setStep = useSetOnboardingStepMutation();
  const step =
    appState.projects.length === 0 ? "addProject" : appState.onboardingStep;

  if (step === "addProject") {
    return (
      <OnboardingFrame
        current={1}
        icon={<FolderOpen size={20} />}
        title={t("addProject.title")}
      >
        <p className="mb-1 text-muted-foreground">
          {t("addProject.description")}
        </p>
        <Button disabled={addPending} onClick={onAddProject}>
          {addPending ? t("addProject.adding") : t("addProject.chooseFolder")}
        </Button>
        {error !== null && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </OnboardingFrame>
    );
  }

  if (step === "quickCapture") {
    return (
      <OnboardingFrame
        current={2}
        icon={<Zap size={20} />}
        title={t("quickCapture.title")}
      >
        <p className="mb-1 text-muted-foreground">
          {t("quickCapture.description")}
        </p>
        <SettingsPage compact="quickCapture" onBack={() => undefined} />
        <OnboardingActions
          pending={setStep.isPending}
          onContinue={() => void setStep.mutateAsync("codingAgents")}
          onSkip={() => void setStep.mutateAsync("codingAgents")}
        />
      </OnboardingFrame>
    );
  }

  return (
    <OnboardingFrame
      current={3}
      icon={<Bot size={20} />}
      title={t("agents.title")}
    >
      <p className="mb-1 text-muted-foreground">{t("agents.description")}</p>
      <SettingsPage compact="codingAgents" onBack={() => undefined} />
      <OnboardingActions
        finish
        pending={setStep.isPending}
        onContinue={() => void setStep.mutateAsync("complete")}
        onSkip={() => void setStep.mutateAsync("complete")}
      />
    </OnboardingFrame>
  );
}

function OnboardingFrame({
  current,
  icon,
  title,
  children,
}: {
  current: number;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  const { t } = useTranslation("onboarding");
  return (
    <main className="relative flex h-full w-full items-center justify-center bg-background text-muted-foreground">
      <div className="absolute inset-x-0 top-0 h-12" data-tauri-drag-region />
      <section className="relative z-10 grid w-[min(680px,calc(100%_-_48px))] max-w-[680px] justify-items-start gap-2.5 p-6 text-left">
        <div className="grid w-full grid-cols-[42px_1fr_auto] items-center gap-3">
          <span className="inline-flex size-[30px] items-center justify-center rounded-md border border-input bg-elevated text-sm font-semibold text-foreground">
            S
          </span>
          <div>
            <span className="text-[11px] text-muted-foreground">
              {t("progress", { current })}
            </span>
            <h1 className="mt-2 text-lg font-semibold leading-6 text-foreground">
              {title}
            </h1>
          </div>
          {icon}
        </div>
        <div
          className="my-4 grid w-full grid-cols-3 gap-1.5"
          aria-label={t("progress", { current })}
        >
          {[1, 2, 3].map((value) => (
            <span
              className={`h-0.5 ${value <= current ? "bg-ring" : "bg-input"}`}
              key={value}
            />
          ))}
        </div>
        {children}
      </section>
    </main>
  );
}

function OnboardingActions({
  pending,
  finish = false,
  onContinue,
  onSkip,
}: {
  pending: boolean;
  finish?: boolean;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation(["onboarding", "common"]);
  return (
    <div className="mt-4.5 flex w-full justify-end gap-2">
      <Button disabled={pending} onClick={onSkip} variant="outline">
        {t("actions.skip", { ns: "common" })}
      </Button>
      <Button disabled={pending} onClick={onContinue}>
        {finish ? (
          <>
            <Check size={14} /> {t("agents.finish", { ns: "onboarding" })}
          </>
        ) : (
          t("actions.continue", { ns: "common" })
        )}
      </Button>
    </div>
  );
}
