/** Registry store: fetches and caches GET /api/wf/registry (zustand). */

import { create } from "zustand";

import { fetchRegistry } from "../api/workflowApi";

import type { BlockRegistry } from "../types/registry";

interface RegistryState {
  registry: BlockRegistry | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  fetch: (force?: boolean) => Promise<void>;
}

export const useRegistryStore = create<RegistryState>()((set, get) => ({
  registry: null,
  status: "idle",
  error: null,
  fetch: async (force = false) => {
    const { status, registry } = get();
    if (!force && (status === "loading" || registry)) {
      return;
    }
    set({ status: "loading", error: null });
    try {
      const next = await fetchRegistry();
      set({ registry: next, status: "ready" });
    } catch (cause) {
      set({ status: "error", error: cause instanceof Error ? cause.message : String(cause) });
    }
  },
}));
