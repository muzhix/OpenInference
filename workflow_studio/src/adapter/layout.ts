/** Deterministic dagre auto-layout (TB) for nodes lacking stored coordinates. */

import dagre from "@dagrejs/dagre";

import { deriveEdges } from "./edges";

import type { UiPosition, WorkflowSpecification } from "../types/spec";
import { stepsToList } from "../types/spec";

/**
 * Collapsed step card: py-3 (24px) + 40px icon row + 1px top/bottom border.
 */
export const STEP_CARD_HEIGHT = 66;

/**
 * Empty gap between two cards: one and a half step cards. Dagre halves ranksep
 * and inserts a 0-height dummy rank on every edge, so the box gap equals the
 * ranksep passed in.
 */
const NODE_GAP = STEP_CARD_HEIGHT * 1.5;
const RANKSEP = NODE_GAP;
const NODESEP = 60;
const MARGIN = 40;

/**
 * Estimated node sizes (cards are 280px wide + handles/margins). Step height
 * matches the collapsed card so the visual gap is 1.5 node heights.
 */
const NODE_SIZES: Record<string, { width: number; height: number }> = {
  // Bases are the chrome around the rows (header, padding, action). Tuned so a
  // one-row card's layout box matches its rendered height; the rank gap then
  // stays 1.5 step cards below inputs and outputs too.
  inputs: { width: 320, height: 127 },
  outputs: { width: 320, height: 144 },
  step: { width: 320, height: STEP_CARD_HEIGHT },
  note: { width: 200, height: 120 },
};

/**
 * Where a placeholder sits when a block is inserted on the edge from `source`
 * down to a node whose top is `targetY`. Opens a full card plus the default
 * 1.5-card gap on either side, pushing the target down only as far as that requires.
 */
export function insertSlotGeometry(
  source: { x: number; y: number; height: number },
  targetY: number,
): { x: number; y: number; minY: number; dy: number } {
  const sourceBottom = source.y + source.height;
  const slotY = sourceBottom + NODE_GAP;
  const neededTargetTop = slotY + STEP_CARD_HEIGHT + NODE_GAP;
  return {
    x: source.x,
    y: slotY,
    minY: targetY,
    dy: Math.max(0, neededTargetTop - targetY),
  };
}

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
    return { ...NODE_SIZES.inputs, height: NODE_SIZES.inputs.height + rows * 34 };
  }
  if (nodeId === "$outputs") {
    const rows = Math.max(1, (spec.outputs ?? []).length);
    return { ...NODE_SIZES.outputs, height: NODE_SIZES.outputs.height + rows * 52 };
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
