import { Check, FolderOpen, Lightning, Robot } from "@phosphor-icons/react";
import type { ReactNode } from "react";

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
  const setStep = useSetOnboardingStepMutation();
  const step =
    appState.projects.length === 0 ? "addProject" : appState.onboardingStep;

  if (step === "addProject") {
    return (
      <OnboardingFrame
        current={1}
        icon={<FolderOpen size={20} />}
        title="Add your first project"
      >
        <p>
          Choose a folder. Sidequest keeps its quests in a local{" "}
          <code>.sidequest</code> directory inside that exact folder.
        </p>
        <button
          className="primary-button"
          disabled={addPending}
          onClick={onAddProject}
          type="button"
        >
          {addPending ? "Adding…" : "Choose Folder…"}
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
        title="Set up Quick Capture"
      >
        <p>
          Choose how you want to open Quick Capture. You can change these
          settings later.
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
      icon={<Robot size={20} />}
      title="Connect coding agents"
    >
      <p>
        Install the Sidequest skill for the coding agents you use. The managed{" "}
        <code>sq</code> CLI is installed automatically.
      </p>
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
  return (
    <main className="onboarding-shell">
      <div className="standalone-drag-region" data-tauri-drag-region />
      <section className="onboarding-content onboarding-flow">
        <div className="onboarding-heading">
          <span className="app-mark">S</span>
          <div>
            <span className="onboarding-step">Step {current} of 3</span>
            <h1>{title}</h1>
          </div>
          {icon}
        </div>
        <div
          className="onboarding-progress"
          aria-label={`Step ${current} of 3`}
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
  return (
    <div className="onboarding-actions">
      <button disabled={pending} onClick={onSkip} type="button">
        Skip
      </button>
      <button
        className="primary-button"
        disabled={pending}
        onClick={onContinue}
        type="button"
      >
        {finish ? (
          <>
            <Check size={14} /> Finish
          </>
        ) : (
          "Continue"
        )}
      </button>
    </div>
  );
}
