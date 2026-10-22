/**
 * Ledger store: workflow list (no configs, 01 §3), batched spec prefetch for
 * card thumbnails (GET /api/wf/configs in chunks of ~20) and the CRUD
 * mutations behind the card menu (01 §4b). Every mutation refreshes the list.
 */

import { create } from "zustand";

import {
  deleteWorkflows,
  fetchConfigs,
  fetchList,
  parseConfig,
  saveWorkflow,
} from "../api/workflowApi";
import { chunk } from "../components/ledger/helpers";

import type { WorkflowSummary } from "../api/workflowApi";
import type { WorkflowSpecification } from "../types/spec";

/** Configs are requested in batches of ~20 ids (README API contract table). */
const CONFIG_BATCH_SIZE = 20;

export type SpecState = "loading" | "ready" | "error";

interface LedgerState {
  workflows: WorkflowSummary[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  /** Latest config per workflow id, for card thumbnails. */
  specs: Record<string, WorkflowSpecification | null>;
  specStates: Record<string, SpecState>;
  creating: boolean;
  mutating: boolean;
  mutationError: string | null;
  fetch: () => Promise<void>;
  create: () => Promise<WorkflowSummary | null>;
  duplicate: (workflowId: string) => Promise<void>;
  rename: (workflowId: string, name: string) => Promise<void>;
  trash: (workflowIds: string[]) => Promise<void>;
  clearMutationError: () => void;
}

/** Monotonic token so stale config batches never overwrite a newer load. */
let specEpoch = 0;

function toMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

async function loadSpecs(workflows: WorkflowSummary[]): Promise<void> {
  const epoch = ++specEpoch;
  const missing = workflows.filter((workflow) => !useLedgerStore.getState().specStates[workflow.id]);
  if (missing.length === 0) {
    return;
  }
  useLedgerStore.setState((state) => ({
    specStates: {
      ...state.specStates,
      ...Object.fromEntries(missing.map((workflow) => [workflow.id, "loading" as SpecState])),
    },
  }));
  for (const batch of chunk(missing.map((workflow) => workflow.id), CONFIG_BATCH_SIZE)) {
    let configs: Record<string, WorkflowSpecification | string | null> = {};
    let failed = false;
    try {
      ({ configs } = await fetchConfigs(batch));
    } catch {
      failed = true;
    }
    if (epoch !== specEpoch) {
      return; // a newer load (or trash) superseded this batch
    }
    useLedgerStore.setState((state) => ({
      specs: {
        ...state.specs,
        ...Object.fromEntries(
          batch.map((id) => [id, failed ? null : parseConfig(configs[id] ?? null)]),
        ),
      },
      specStates: {
        ...state.specStates,
        ...Object.fromEntries(batch.map((id) => [id, failed ? "error" : "ready"] as const)),
      },
    }));
  }
}

function pruneSpecs(workflows: WorkflowSummary[]): Partial<LedgerState> {
  const live = new Set(workflows.map((workflow) => workflow.id));
  const { specs, specStates } = useLedgerStore.getState();
  return {
    specs: Object.fromEntries(Object.entries(specs).filter(([id]) => live.has(id))),
    specStates: Object.fromEntries(Object.entries(specStates).filter(([id]) => live.has(id))),
  };
}

async function refresh(): Promise<void> {
  const { workflows } = await fetchList();
  useLedgerStore.setState({ workflows, status: "ready", error: null, ...pruneSpecs(workflows) });
  void loadSpecs(workflows);
}

export const useLedgerStore = create<LedgerState>()((set) => ({
  workflows: [],
  status: "idle",
  error: null,
  specs: {},
  specStates: {},
  creating: false,
  mutating: false,
  mutationError: null,

  fetch: async () => {
    if (useLedgerStore.getState().status === "loading") {
      return; // in-flight (e.g. StrictMode double-mount)
    }
    set({ status: "loading", error: null });
    try {
      await refresh();
    } catch (cause) {
      set({ status: "error", error: toMessage(cause) });
    }
  },

  create: async () => {
    set({ creating: true, mutationError: null });
    try {
      const { workflow } = await saveWorkflow({ name: "Custom Workflow" });
      await refresh();
      return workflow as WorkflowSummary;
    } catch (cause) {
      set({ mutationError: toMessage(cause) });
      return null;
    } finally {
      set({ creating: false });
    }
  },

  duplicate: async (workflowId) => {
    set({ mutating: true, mutationError: null });
    try {
      await saveWorkflow({ template: "duplicate", sourceId: workflowId });
      await refresh();
    } catch (cause) {
      set({ mutationError: toMessage(cause) });
    } finally {
      set({ mutating: false });
    }
  },

  rename: async (workflowId, name) => {
    set({ mutating: true, mutationError: null });
    try {
      await saveWorkflow({ id: workflowId, name });
      await refresh();
    } catch (cause) {
      set({ mutationError: toMessage(cause) });
    } finally {
      set({ mutating: false });
    }
  },

  trash: async (workflowIds) => {
    set({ mutating: true, mutationError: null });
    specEpoch += 1; // cancel in-flight spec batches for doomed ids
    try {
      await deleteWorkflows(workflowIds);
      await refresh();
    } catch (cause) {
      set({ mutationError: toMessage(cause) });
    } finally {
      set({ mutating: false });
    }
  },

  clearMutationError: () => {
    set({ mutationError: null });
  },
}));
