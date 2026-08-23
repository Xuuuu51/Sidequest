import { create } from "zustand";

type CapturePhase = "idle" | "saving" | "saved" | "error";

interface QuickCaptureState {
  draft: string;
  selectedProjectPath: string | null;
  phase: CapturePhase;
  error: string | null;
  setDraft: (draft: string) => void;
  setSelectedProjectPath: (path: string | null) => void;
  setPhase: (phase: CapturePhase, error?: string | null) => void;
  clearDraft: () => void;
}

export const useQuickCaptureStore = create<QuickCaptureState>((set) => ({
  draft: "",
  selectedProjectPath: null,
  phase: "idle",
  error: null,
  setDraft: (draft) => set({ draft, phase: "idle", error: null }),
  setSelectedProjectPath: (selectedProjectPath) =>
    set({ selectedProjectPath, phase: "idle", error: null }),
  setPhase: (phase, error = null) => set({ phase, error }),
  clearDraft: () => set({ draft: "", phase: "idle", error: null }),
}));
