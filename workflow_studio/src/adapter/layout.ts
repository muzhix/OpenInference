/** Deterministic dagre auto-layout (TB) for nodes lacking stored coordinates. */

import dagre from "@dagrejs/dagre";

import { deriveEdges } from "./edges";

import type { UiPosition, WorkflowSpecification } from "../types/spec";
import { stepsToList } from "../types/spec";

const RANKSEP = 90;
const NODESEP = 50;
const MARGIN = 40;

/** Estimated node sizes (cards are 280px wide + handles/margins). */
const NODE_SIZES: Record<string, { width: number; height: number }> = {
  inputs: { width: 320, height: 96 },
  outputs: { width: 320, height: 96 },
  step: { width: 320, height: 120 },
  note: { width: 200, height: 120 },
};

/**
 * Compute top-to-bottom layout coordinates for every node id that appears in
 * `nodeIds` (inputs at the top, steps below, outputs at the bottom — matching
 * the cloud builder). Deterministic: same spec in, same coordinates out.
 */
export function computeAutoLayout(
  spec: WorkflowSpecification,
  nodeIds: string[],
): Record<string, UiPosition> {
  const graph = new dagre.graphlib.Graph<{ width: number; height: number }>();
  graph.setGraph({ rankdir: "TB", ranksep: RANKSEP, nodesep: NODESEP, marginx: MARGIN, marginy: MARGIN });
  graph.setDefaultEdgeLabel(() => ({}));

  const ids = new Set(nodeIds);
  for (const id of ids) {
    const size = sizeForNodeId(id, spec);
    graph.setNode(id, size);
  }
  for (const edge of deriveEdges(spec)) {
    if (ids.has(edge.source) && ids.has(edge.target)) {
      graph.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(graph);

  const positions: Record<string, UiPosition> = {};
  for (const id of graph.nodes()) {
    const node = graph.node(id);
    if (node) {
      positions[id] = { x: Math.round(node.x - node.width / 2), y: Math.round(node.y - node.height / 2) };
    }
  }
  return positions;
}

function sizeForNodeId(nodeId: string, spec: WorkflowSpecification): { width: number; height: number } {
  // Always return a fresh object: dagre mutates node labels in place, so a
  // shared reference would collapse every step onto one position.
  if (nodeId === "$inputs") {
    const rows = Math.max(1, (spec.inputs ?? []).length);
    return { ...NODE_SIZES.inputs, height: NODE_SIZES.inputs.height + rows * 8 };
  }
  if (nodeId === "$outputs") {
    const rows = Math.max(1, (spec.outputs ?? []).length);
    return { ...NODE_SIZES.outputs, height: NODE_SIZES.outputs.height + rows * 8 };
  }
  if (nodeId.startsWith("note:")) {
    return { ...NODE_SIZES.note };
  }
  return { ...NODE_SIZES.step };
}

/** All graph node ids for a spec: $inputs, step nodes, $outputs. */
export function graphNodeIds(spec: WorkflowSpecification): string[] {
  const ids: string[] = ["$inputs"];
  for (const { name } of stepsToList(spec.steps)) {
    ids.push(`$steps.${name}`);
  }
  ids.push("$outputs");
  return ids;
}
