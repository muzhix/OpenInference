/**
 * Editor store: the spec is the single source of truth. All edits are spec
 * mutations (immutable); nodes/edges/viewport are derived. Undo/redo = spec
 * snapshots (capped). Component-facing mutation helpers wrap adapter
 * mutations so every edit funnels through `mutate`.
 */

import { create } from "zustand";

import {
  addInput,
  addNote,
  addOutput,
  addStep,
  applyNodePositions,
  computeAutoLayout,
  exportSpec,
  graphNodeIds,
  generateStepName,
  localValidate,
  removeNode,
  removeNote,
  removeOutput,
  renameStep,
  setOutputSelector,
  setParam,
  toggleDisabled,
  updateNote,
  editInput,
  moveInput,
  removeInput,
  renameInput,
  renameOutput,
} from "../adapter";
import type { ValidationIssue } from "../adapter";
import { fetchGet, fetchSpec, parseConfig, saveDraft, saveWorkflow, validateSpec } from "../api/workflowApi";
import type { WorkflowDetail } from "../api/workflowApi";

import type { UiNote, UiPosition, WorkflowSpecification } from "../types/spec";

import { useRegistryStore } from "./registryStore";

const UNDO_LIMIT = 100;
const SERVER_VALIDATION_DEBOUNCE_MS = 600;

/**
 * Palette open state: the flow-space anchor (viewport center when opened) used
 * to place added blocks. The panel itself is fixed to the canvas edges.
 */
export interface PaletteState {
  flowX: number;
  flowY: number;
}

interface EditorState {
  workflowId: string | null;
  workflowUrl: string | null;
  workflowName: string;
  spec: WorkflowSpecification | null;
  lastSavedSpec: WorkflowSpecification | null;
  published: boolean;
  hasUnpublishedChanges: boolean;

  loadStatus: "idle" | "loading" | "ready" | "error";
  loadError: string | null;
  saving: boolean;
  saveError: string | null;
  saveFlashAt: number | null;
  publishing: boolean;

  localValidation: { errors: ValidationIssue[]; warnings: ValidationIssue[] };
  serverValidation: { errors: ValidationIssue[]; warnings: ValidationIssue[] };

  undoStack: WorkflowSpecification[];
  redoStack: WorkflowSpecification[];

  selectedNodeId: string | null;
  expandedNodeId: string | null;
  palette: PaletteState | null;
  runPanelOpen: boolean;
  livePositions: Record<string, UiPosition>;
  canvasLocked: boolean;
  minimapVisible: boolean;
  /** Official "Arrange automatically": re-run auto layout whenever blocks are added. */
  autoArrange: boolean;

  loadWorkflow: (url: string | null) => Promise<void>;
  mutate: (
    updater: (spec: WorkflowSpecification) => WorkflowSpecification,
    options?: { undoable?: boolean },
  ) => void;
  undo: () => void;
  redo: () => void;
  setLivePosition: (nodeId: string, position: UiPosition) => void;
  commitLivePositions: () => void;
  setSelected: (nodeId: string | null) => void;
  setExpanded: (nodeId: string | null) => void;
  openPalette: (position?: PaletteState) => void;
  closePalette: () => void;
  toggleRunPanel: () => void;
  setCanvasLocked: (locked: boolean) => void;
  toggleMinimap: () => void;
  toggleAutoArrange: () => void;

  addBlock: (manifestType: string) => void;
  removeNodes: (nodeKeys: string[]) => void;
  renameStepNode: (oldName: string, newName: string) => void;
  setStepParam: (stepName: string, property: string, value: unknown) => void;
  setOutputBinding: (name: string, selector: string) => void;
  addWorkflowOutput: () => void;
  removeWorkflowOutput: (name: string) => void;
  addWorkflowInput: (name: string, type: string, kind?: string[], defaultValue?: unknown) => void;
  removeWorkflowInput: (name: string) => void;
  renameWorkflowInput: (oldName: string, newName: string) => void;
  moveWorkflowInput: (name: string, toIndex: number) => void;
  editWorkflowInput: (
    oldName: string,
    newName: string,
    defaultUpdate?: { value: unknown; kind?: string[] } | "clear",
  ) => void;
  renameWorkflowOutput: (oldName: string, newName: string) => void;
  toggleNodeDisabled: (nodeKey: string) => void;
  addNoteAt: (position: UiPosition, text?: string) => void;
  updateNoteText: (noteId: string, text: string) => void;
  deleteNote: (noteId: string) => void;
  applyLayout: (positions: Record<string, UiPosition>) => void;

  save: () => Promise<void>;
  publish: () => Promise<void>;
}

export type EditorStore = EditorState;

function blankSpec(): WorkflowSpecification {
  return {
    version: "1.0",
    inputs: [{ type: "WorkflowImage", name: "image" }],
    steps: [],
    outputs: [],
    metadata: { ui: { nodes: { $inputs: { x: 60, y: 160 }, $outputs: { x: 760, y: 160 } } } },
  };
}

function canonical(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortKeys(item)]),
    );
  }
  return value;
}

function validationOf(spec: WorkflowSpecification): Pick<EditorState, "localValidation"> {
  const result = localValidate(spec, useRegistryStore.getState().registry);
  return { localValidation: { errors: result.errors, warnings: result.warnings } };
}

function publishStateFrom(detail: WorkflowDetail | null, spec: WorkflowSpecification): Pick<EditorState, "published" | "hasUnpublishedChanges"> {
  const publishedConfig = parseConfig(detail?.lastVersionConfig ?? null);
  const published = publishedConfig !== null;
  return {
    published,
    hasUnpublishedChanges: published && canonical(publishedConfig) !== canonical(spec),
  };
}

let validationTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleServerValidation(): void {
  if (validationTimer) {
    clearTimeout(validationTimer);
  }
  validationTimer = setTimeout(() => {
    validationTimer = null;
    const { spec } = useEditorStore.getState();
    if (!spec) {
      return;
    }
    validateSpec(spec)
      .then((response) => {
        useEditorStore.setState({
          serverValidation: {
            errors: (response.errors ?? []).map(normalizeIssue),
            warnings: (response.warnings ?? []).map(normalizeIssue),
          },
        });
      })
      .catch(() => {
        // Backend unavailable: local validation remains the instant source of truth.
      });
  }, SERVER_VALIDATION_DEBOUNCE_MS);
}

function normalizeIssue(issue: { code: string; path?: string; message: string }): ValidationIssue {
  return { code: issue.code, path: issue.path ?? "", message: issue.message };
}

async function refreshAfterWrite(
  url: string,
  fallbackConfig: WorkflowSpecification | null,
): Promise<void> {
  const [specResponse, detailResponse] = await Promise.allSettled([fetchSpec(url), fetchGet(url)]);
  const fresh = specResponse.status === "fulfilled" ? parseConfig(specResponse.value.workflowSpec.config) : null;
  const spec = fresh ?? fallbackConfig ?? useEditorStore.getState().spec;
  if (!spec) {
    return;
  }
  const detail = detailResponse.status === "fulfilled" ? detailResponse.value.workflow : null;
  useEditorStore.setState({
    spec,
    lastSavedSpec: spec,
    workflowName: detail?.name ?? useEditorStore.getState().workflowName,
    ...publishStateFrom(detail, spec),
    ...validationOf(spec),
  });
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  workflowId: null,
  workflowUrl: null,
  workflowName: "",
  spec: null,
  lastSavedSpec: null,
  published: false,
  hasUnpublishedChanges: false,
  loadStatus: "idle",
  loadError: null,
  saving: false,
  saveError: null,
  saveFlashAt: null,
  publishing: false,
  localValidation: { errors: [], warnings: [] },
  serverValidation: { errors: [], warnings: [] },
  undoStack: [],
  redoStack: [],
  selectedNodeId: null,
  expandedNodeId: null,
  palette: null,
  runPanelOpen: false,
  livePositions: {},
  canvasLocked: false,
  minimapVisible: false,
  autoArrange: true,

  loadWorkflow: async (url) => {
    set({
      loadStatus: "loading",
      loadError: null,
      undoStack: [],
      redoStack: [],
      selectedNodeId: null,
      expandedNodeId: null,
      palette: null,
      runPanelOpen: false,
    });
    if (!url) {
      const spec = blankSpec();
      set({
        workflowId: null,
        workflowUrl: null,
        workflowName: "Untitled workflow",
        spec,
        lastSavedSpec: null,
        published: false,
        hasUnpublishedChanges: false,
        loadStatus: "ready",
        ...validationOf(spec),
      });
      return;
    }
    try {
      const { workflow } = await fetchGet(url);
      const spec = parseConfig(workflow.config) ?? blankSpec();
      set({
        workflowId: workflow.id,
        workflowUrl: workflow.url ?? url,
        workflowName: workflow.name,
        spec,
        lastSavedSpec: spec,
        ...publishStateFrom(workflow, spec),
        loadStatus: "ready",
        ...validationOf(spec),
      });
    } catch (cause) {
      set({
        loadStatus: "error",
        loadError: cause instanceof Error ? cause.message : String(cause),
      });
    }
  },

  mutate: (updater, options) => {
    const { spec, undoStack } = get();
    if (!spec) {
      return;
    }
    const next = updater(spec);
    if (next === spec) {
      return;
    }
    const undoable = options?.undoable !== false;
    set({
      spec: next,
      undoStack: undoable ? [...undoStack.slice(-(UNDO_LIMIT - 1)), spec] : undoStack,
      redoStack: [],
      ...validationOf(next),
    });
    scheduleServerValidation();
  },

  undo: () => {
    const { undoStack, redoStack, spec } = get();
    if (undoStack.length === 0 || !spec) {
      return;
    }
    const previous = undoStack[undoStack.length - 1]!;
    set({
      spec: previous,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, spec],
      ...validationOf(previous),
    });
    scheduleServerValidation();
  },

  redo: () => {
    const { undoStack, redoStack, spec } = get();
    if (redoStack.length === 0 || !spec) {
      return;
    }
    const next = redoStack[redoStack.length - 1]!;
    set({
      spec: next,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, spec],
      ...validationOf(next),
    });
    scheduleServerValidation();
  },

  setLivePosition: (nodeId, position) => {
    set({ livePositions: { ...get().livePositions, [nodeId]: position } });
  },

  commitLivePositions: () => {
    const live = get().livePositions;
    if (Object.keys(live).length === 0) {
      return;
    }
    set({ livePositions: {} });
    get().mutate((spec) => applyNodePositions(spec, live));
  },

  setSelected: (nodeId) => {
    const { expandedNodeId } = get();
    set({
      selectedNodeId: nodeId,
      expandedNodeId: nodeId ? expandedNodeId : null,
    });
  },

  setExpanded: (nodeId) => {
    set({ expandedNodeId: nodeId, selectedNodeId: nodeId ?? get().selectedNodeId });
  },

  openPalette: (position) => set({ palette: position }),
  closePalette: () => set({ palette: null }),
  toggleRunPanel: () => set({ runPanelOpen: !get().runPanelOpen }),
  setCanvasLocked: (locked) => set({ canvasLocked: locked }),
  toggleMinimap: () => set({ minimapVisible: !get().minimapVisible }),
  toggleAutoArrange: () => set({ autoArrange: !get().autoArrange }),

  addBlock: (manifestType) => {
    const { palette, spec } = get();
    if (!spec) {
      return;
    }
    // Place added blocks at the palette's anchor with a small cascade so
    // successive adds do not stack exactly on top of each other.
    const stepCount = Array.isArray(spec.steps) ? spec.steps.length : Object.keys(spec.steps ?? {}).length;
    const base = palette ?? { flowX: 140, flowY: 180 };
    const position: UiPosition = {
      x: base.flowX + (stepCount % 5) * 36,
      y: base.flowY + Math.floor(stepCount / 5) * 36,
    };
    const name = generateStepName(spec, manifestType);
    get().mutate((current) => {
      const withStep = addStep(current, manifestType, undefined, position, useRegistryStore.getState().registry);
      // Official "Arrange automatically": the re-arrange shares the add's
      // single undo step, and never fires for drags or sticky notes.
      return get().autoArrange
        ? applyNodePositions(withStep, computeAutoLayout(withStep, graphNodeIds(withStep)))
        : withStep;
    });
    set({ palette: null, selectedNodeId: null, expandedNodeId: null });
  },

  removeNodes: (nodeKeys) => {
    get().mutate((spec) => nodeKeys.reduce((acc, key) => removeNode(acc, key), spec));
    const removed = new Set(nodeKeys);
    if (get().selectedNodeId && removed.has(get().selectedNodeId!)) {
      set({ selectedNodeId: null, expandedNodeId: null });
    }
    if (get().expandedNodeId && removed.has(get().expandedNodeId!)) {
      set({ expandedNodeId: null });
    }
  },

  renameStepNode: (oldName, newName) => {
    get().mutate((spec) => renameStep(spec, oldName, newName));
    const { selectedNodeId, expandedNodeId } = get();
    set({
      selectedNodeId: selectedNodeId === `$steps.${oldName}` ? `$steps.${newName}` : selectedNodeId,
      expandedNodeId: expandedNodeId === `$steps.${oldName}` ? `$steps.${newName}` : expandedNodeId,
    });
  },

  setStepParam: (stepName, property, value) => {
    get().mutate((spec) => setParam(spec, stepName, property, value));
  },

  setOutputBinding: (name, selector) => {
    get().mutate((spec) => setOutputSelector(spec, name, selector));
  },

  addWorkflowOutput: () => {
    get().mutate((spec) => addOutput(spec));
  },

  removeWorkflowOutput: (name) => {
    get().mutate((spec) => removeOutput(spec, name));
  },
  addWorkflowInput: (name, type, kind, defaultValue) => {
    get().mutate((spec) => addInput(spec, name, type, kind, defaultValue));
  },
  removeWorkflowInput: (name) => {
    get().mutate((spec) => removeInput(spec, name));
  },
  renameWorkflowInput: (oldName, newName) => {
    get().mutate((spec) => renameInput(spec, oldName, newName));
  },
  moveWorkflowInput: (name, toIndex) => {
    get().mutate((spec) => moveInput(spec, name, toIndex));
  },
  editWorkflowInput: (oldName, newName, defaultUpdate) => {
    get().mutate((spec) => editInput(spec, oldName, newName, defaultUpdate));
  },
  renameWorkflowOutput: (oldName, newName) => {
    get().mutate((spec) => renameOutput(spec, oldName, newName));
  },

  toggleNodeDisabled: (nodeKey) => {
    get().mutate((spec) => toggleDisabled(spec, nodeKey));
  },

  addNoteAt: (position, text = "") => {
    const note: UiNote = {
      id: `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      x: position.x,
      y: position.y,
      text,
    };
    get().mutate((spec) => addNote(spec, note), { undoable: false });
  },

  updateNoteText: (noteId, text) => {
    get().mutate((spec) => updateNote(spec, noteId, { text }), { undoable: false });
  },

  deleteNote: (noteId) => {
    get().mutate((spec) => removeNote(spec, noteId));
  },

  applyLayout: (positions) => {
    get().mutate((spec) => applyNodePositions(spec, positions));
  },

  save: async () => {
    const state = get();
    if (!state.workflowId || !state.spec || state.saving) {
      return;
    }
    if (!selectCanSave(state)) {
      return;
    }
    const url = state.workflowUrl ?? "";
    set({ saving: true, saveError: null });
    const config = exportSpec(state.spec);
    try {
      await saveDraft(state.workflowId, config);
      await refreshAfterWrite(url, config);
      set({ saving: false, saveFlashAt: Date.now() });
    } catch (cause) {
      set({ saving: false, saveError: cause instanceof Error ? cause.message : String(cause) });
    }
  },

  publish: async () => {
    const state = get();
    if (!state.workflowId || state.publishing) {
      return;
    }
    const url = state.workflowUrl ?? "";
    set({ publishing: true, saveError: null });
    try {
      await saveWorkflow({ id: state.workflowId, publish: true });
      await refreshAfterWrite(url, null);
      set({ publishing: false });
    } catch (cause) {
      set({ publishing: false, saveError: cause instanceof Error ? cause.message : String(cause) });
    }
  },
}));

export function selectValidation(state: EditorState): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  return {
    errors: [...state.localValidation.errors, ...state.serverValidation.errors],
    warnings: [...state.localValidation.warnings, ...state.serverValidation.warnings],
  };
}

export function selectDirty(state: EditorState): boolean {
  return state.spec !== null && state.spec !== state.lastSavedSpec;
}

export function selectCanSave(state: EditorState): boolean {
  return (
    state.workflowId !== null &&
    selectDirty(state) &&
    selectValidation(state).errors.length === 0 &&
    !state.saving
  );
}
