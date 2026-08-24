import type { StateCreator } from "zustand";

import type { EditorSlice, MainWindowStore } from "./types";

export const createEditorSlice: StateCreator<
  MainWindowStore,
  [],
  [],
  EditorSlice
> = (set) => ({
  editor: null,
  statusMenuOpen: false,
  deleteConfirming: false,
  deleteError: null,
  navigationPending: false,
  navigationIntent: null,
  initializeEditor: (projectPath, questId, content, createdAt, status) =>
    set({
      editor: {
        projectPath,
        questId,
        createdAt,
        status,
        baseContent: content,
        draftContent: content,
        phase: "viewing",
        conflict: null,
        error: null,
        savedVisible: false,
      },
      statusMenuOpen: false,
      deleteConfirming: false,
      deleteError: null,
    }),
  setEditorStatus: (status) =>
    set((state) =>
      state.editor === null ? {} : { editor: { ...state.editor, status } },
    ),
  startEditing: () =>
    set((state) =>
      state.editor === null || state.editor.phase === "externalConflict"
        ? {}
        : { editor: { ...state.editor, phase: "editing" } },
    ),
  stopEditing: () =>
    set((state) =>
      state.editor === null ||
      state.editor.draftContent !== state.editor.baseContent
        ? {}
        : { editor: { ...state.editor, phase: "viewing" } },
    ),
  changeDraft: (draftContent) =>
    set((state) => {
      if (state.editor === null || state.editor.phase === "externalConflict") {
        return {};
      }
      return {
        editor: {
          ...state.editor,
          draftContent,
          phase:
            draftContent === state.editor.baseContent ? "editing" : "pending",
          error: null,
          savedVisible: false,
        },
      };
    }),
  beginSaving: () =>
    set((state) =>
      state.editor === null
        ? {}
        : {
            editor: {
              ...state.editor,
              phase: "saving",
              error: null,
              savedVisible: false,
            },
          },
    ),
  completeSaving: (savedContent) =>
    set((state) => {
      if (state.editor === null) return {};
      const stillDirty = state.editor.draftContent !== savedContent;
      return {
        editor: {
          ...state.editor,
          baseContent: savedContent,
          phase: stillDirty ? "pending" : "editing",
          conflict: null,
          error: null,
          savedVisible: !stillDirty,
        },
      };
    }),
  failSaving: (error) =>
    set((state) =>
      state.editor === null
        ? {}
        : {
            editor: {
              ...state.editor,
              phase: "saveError",
              error,
              savedVisible: false,
            },
          },
    ),
  clearSavedFeedback: () =>
    set((state) =>
      state.editor === null
        ? {}
        : { editor: { ...state.editor, savedVisible: false } },
    ),
  setExternalConflict: (conflict) =>
    set((state) =>
      state.editor === null
        ? {}
        : {
            editor: {
              ...state.editor,
              phase: "externalConflict",
              conflict,
              error: null,
              savedVisible: false,
            },
          },
    ),
  loadDiskContent: (content) =>
    set((state) =>
      state.editor === null
        ? {}
        : {
            editor: {
              ...state.editor,
              baseContent: content,
              draftContent: content,
              phase: "viewing",
              conflict: null,
              error: null,
              savedVisible: false,
            },
          },
    ),
  clearEditor: () =>
    set({
      editor: null,
      statusMenuOpen: false,
      deleteConfirming: false,
      deleteError: null,
      navigationPending: false,
      navigationIntent: null,
    }),
  setStatusMenuOpen: (statusMenuOpen) => set({ statusMenuOpen }),
  setDeleteConfirming: (deleteConfirming) =>
    set({ deleteConfirming, deleteError: null }),
  setDeleteError: (deleteError) => set({ deleteError }),
  setNavigationPending: (navigationPending, navigationIntent = null) =>
    set({
      navigationPending,
      navigationIntent: navigationPending ? navigationIntent : null,
    }),
});
