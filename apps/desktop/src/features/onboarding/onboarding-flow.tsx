import { Check, FolderOpen, Lightning, Robot } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useSetOnboardingStepMutation } from "../data/queries";
import { SettingsPage } from "../settings/settings-page";
import type { AppStateDto } from "../../shared/tauri/types";

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
        <p>{t("addProject.description")}</p>
        <button
          className="primary-button"
          disabled={addPending}
          onClick={onAddProject}
          type="button"
        >
          {addPending ? t("addProject.adding") : t("addProject.chooseFolder")}
        </button>
        {error !== null && (
          <p className="onboarding-error" role="alert">
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
        icon={<Lightning size={20} />}
        title={t("quickCapture.title")}
      >
        <p>{t("quickCapture.description")}</p>
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
      icon={<Robot size={20} />}
      title={t("agents.title")}
    >
      <p>{t("agents.description")}</p>
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
    <main className="onboarding-shell">
      <div className="standalone-drag-region" data-tauri-drag-region />
      <section className="onboarding-content onboarding-flow">
        <div className="onboarding-heading">
          <span className="app-mark">S</span>
          <div>
            <span className="onboarding-step">
              {t("progress", { current })}
            </span>
            <h1>{title}</h1>
          </div>
          {icon}
        </div>
        <div
          className="onboarding-progress"
          aria-label={t("progress", { current })}
        >
          {[1, 2, 3].map((value) => (
            <span className={value <= current ? "active" : ""} key={value} />
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
    <div className="onboarding-actions">
      <button disabled={pending} onClick={onSkip} type="button">
        {t("actions.skip", { ns: "common" })}
      </button>
      <button
        className="primary-button"
        disabled={pending}
        onClick={onContinue}
        type="button"
      >
        {finish ? (
          <>
            <Check size={14} /> {t("agents.finish", { ns: "onboarding" })}
          </>
        ) : (
          t("actions.continue", { ns: "common" })
        )}
      </button>
    </div>
  );
}
