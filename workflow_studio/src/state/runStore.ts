/**
 * Run panel store (M4): committed test input, execution state, results and
 * canvas step thumbnails. Execution always re-fetches the latest spec first
 * (所见即所跑, D5) — the fetched config is what runs, never the live editor
 * state (except for unsaved local workflows with no server copy).
 */

import { create } from "zustand";

import { fetchSpec, parseConfig, runWorkflow } from "../api/workflowApi";
import type { WorkflowSpecification } from "../types/spec";
import {
  buildRunInputs,
  deriveStepThumbnails,
  extractRunErrorMessage,
} from "../components/run/runUtils";
import type { RunImageInput } from "../components/run/runUtils";

import { useEditorStore } from "./editorStore";

export type RunPanelMode = "input" | "results";

interface RunState {
  mode: RunPanelMode;
  imageInput: RunImageInput | null;
  running: boolean;
  /** First (batch) output record; keys align with spec outputs[].name (D3). */
  outputs: Record<string, unknown> | null;
  rawResponse: unknown;
  /** Spec whose execution produced the current results (output ordering). */
  runSpec: WorkflowSpecification | null;
  error: string | null;
  /** Step name -> result thumbnail data URL (D3 node-level thumbnails). */
  stepThumbnails: Record<string, string>;

  setInput: (input: RunImageInput | null) => void;
  run: () => Promise<void>;
  editInput: () => void;
  reset: () => void;
}

const INITIAL: Pick<RunState, "mode" | "running" | "outputs" | "rawResponse" | "runSpec" | "error" | "stepThumbnails"> = {
  mode: "input",
  running: false,
  outputs: null,
  rawResponse: null,
  runSpec: null,
  error: null,
  stepThumbnails: {},
};

export const useRunStore = create<RunState>()((set, get) => ({
  ...INITIAL,
  imageInput: null,

  setInput: (input) => set({ imageInput: input, error: null }),

  run: async () => {
    const { imageInput, running } = get();
    if (!imageInput || running) {
      return;
    }
    set({ running: true, error: null });
    try {
      const spec = await fetchRunSpec();
      if (!spec) {
        throw new Error("No workflow specification available to run");
      }
      const response = await runWorkflow(spec, buildRunInputs(imageInput));
      const outputs = Array.isArray(response.outputs) ? (response.outputs[0] ?? null) : null;
      set({
        running: false,
        mode: "results",
        outputs,
        rawResponse: response,
        runSpec: spec,
        stepThumbnails: outputs ? deriveStepThumbnails(spec, outputs) : {},
      });
    } catch (cause) {
      // Stay in the input state and surface the server message (D2).
      set({ running: false, error: extractRunErrorMessage(cause) });
    }
  },

  editInput: () => set({ mode: "input" }),

  reset: () => set({ ...INITIAL, imageInput: null }),
}));

/** Re-fetch the latest draft spec; fall back to the live editor spec for unsaved workflows. */
async function fetchRunSpec(): Promise<WorkflowSpecification | null> {
  const { workflowUrl, spec } = useEditorStore.getState();
  if (workflowUrl) {
    const response = await fetchSpec(workflowUrl);
    return parseConfig(response.workflowSpec.config);
  }
  return spec;
}
