/** Rebuild metadata.ui for persistence: positions + UI edge projection. */

import { deriveEdges } from "./edges";

import type { UiEdgeProjection, UiPosition, WorkflowSpecification } from "../types/spec";

const NODE_KEY_RE = /^\$(?:inputs|outputs)$|^\$steps\.[^.]+$/;

/**
 * Produce a spec whose metadata.ui is rebuilt: nodes = supplied positions
 * (falling back to the spec's stored positions), edges = UI projection of the
 * semantic references, groups/notes/disabled preserved. The semantic parts
 * (inputs/steps/outputs) are passed through unchanged.
 */
export function exportSpec(
  spec: WorkflowSpecification,
  positions?: Record<string, UiPosition>,
): WorkflowSpecification {
  const ui = spec.metadata?.ui ?? {};
  const nodePositions: Record<string, UiPosition> = {};
  for (const [key, value] of Object.entries(ui.nodes ?? {})) {
    nodePositions[key] = { x: value.x, y: value.y };
  }
  for (const [key, value] of Object.entries(positions ?? {})) {
    if (NODE_KEY_RE.test(key)) {
      nodePositions[key] = { x: value.x, y: value.y };
    }
  }

  const edges: UiEdgeProjection[] = deriveEdges(spec).map((edge) => ({
    source: edge.source,
    target: edge.target,
    inputProperty: edge.targetInput,
    sourceSelector: edge.sourceOutput,
  }));

  const nextUi: NonNullable<WorkflowSpecification["metadata"]>["ui"] = {
    nodes: nodePositions,
    edges,
    groups: ui.groups ?? [],
  };
  if (ui.notes && ui.notes.length > 0) {
    nextUi.notes = ui.notes.map((note) => ({ ...note }));
  }
  if (ui.disabled && ui.disabled.length > 0) {
    nextUi.disabled = [...ui.disabled];
  }

  return {
    ...spec,
    metadata: { ...(spec.metadata ?? {}), ui: nextUi },
  };
}
