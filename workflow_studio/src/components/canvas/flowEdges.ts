/** Visual connection between two nodes: one line, every binding it carries. */

import { MarkerType } from "@xyflow/react";

import type { AppEdge } from "../../adapter";
import type { EdgeBinding } from "../../adapter";

export const FLOW_EDGE_TYPE = "flow";
export const INSERT_PLACEHOLDER_ID = "$insert";

const FLOW_MARKER = { type: MarkerType.ArrowClosed, width: 12, height: 12, color: "#B4B8C0" };
const DANGLING_MARKER = { type: MarkerType.ArrowClosed, width: 12, height: 12, color: "#DC2626" };

function isDangling(edge: AppEdge): boolean {
  return edge.style?.stroke === "#DC2626";
}

/** Collapse parallel references between the same pair into one drawable edge. */
export function groupFlowEdges(edges: AppEdge[]): AppEdge[] {
  const groups = new Map<string, AppEdge>();
  for (const edge of edges) {
    const key = `${edge.source}=>${edge.target}`;
    const binding: EdgeBinding = {
      sourceOutput: edge.data?.sourceOutput ?? "",
      targetInput: edge.data?.targetInput ?? "",
    };
    const existing = groups.get(key);
    if (!existing) {
      const dangling = isDangling(edge);
      groups.set(key, {
        ...edge,
        id: key,
        type: FLOW_EDGE_TYPE,
        markerEnd: dangling ? DANGLING_MARKER : FLOW_MARKER,
        style: dangling ? { stroke: "#DC2626", strokeWidth: 1.5 } : { stroke: "#C4C7CE", strokeWidth: 1.5 },
        data: {
          sourceOutput: binding.sourceOutput,
          targetInput: binding.targetInput,
          bindings: [binding],
        },
      });
      continue;
    }
    const bindings = [...(existing.data?.bindings ?? []), binding];
    const dangling = isDangling(edge) || isDangling(existing);
    existing.data = {
      sourceOutput: bindings[0]!.sourceOutput,
      targetInput: bindings[0]!.targetInput,
      bindings,
    };
    if (dangling) {
      existing.style = { stroke: "#DC2626", strokeWidth: 1.5 };
      existing.markerEnd = DANGLING_MARKER;
    }
  }
  return [...groups.values()];
}

/** Dashed segment drawn through the insert placeholder. No hover controls. */
export function inertFlowEdge(source: string, target: string): AppEdge {
  return {
    id: `${source}=>${target}`,
    source,
    target,
    sourceHandle: "out",
    targetHandle: "in",
    type: FLOW_EDGE_TYPE,
    markerEnd: FLOW_MARKER,
    style: { stroke: "#C4C7CE", strokeWidth: 1.5 },
    data: { sourceOutput: "", targetInput: "", inert: true, bindings: [] },
  };
}

/** Step or structural name used in the delete confirmation. */
export function connectionNodeLabel(nodeId: string): string {
  if (nodeId.startsWith("$steps.")) {
    return nodeId.slice("$steps.".length);
  }
  if (nodeId === "$outputs") {
    return "outputs";
  }
  if (nodeId === "$inputs") {
    return "inputs";
  }
  return nodeId;
}

/** Target field names cleared when this connection is removed, in edge order. */
export function clearedFields(bindings: EdgeBinding[]): string[] {
  const fields: string[] = [];
  for (const binding of bindings) {
    if (binding.targetInput && !fields.includes(binding.targetInput)) {
      fields.push(binding.targetInput);
    }
  }
  return fields;
}

export function removalWarning(fields: string[], targetId: string): string {
  const count = fields.length;
  const what = targetId === "$outputs"
    ? `${count} ${count === 1 ? "output" : "outputs"}`
    : `${count} input ${count === 1 ? "field" : "fields"}`;
  return `Warning: Removing this connection will clear ${what}: ${fields.join(", ")}`;
}

export function confirmClearMessage(count: number, nodeId: string): string {
  const noun = count === 1 ? "property" : "properties";
  return `Will clear ${count} ${noun} from ${connectionNodeLabel(nodeId)} node`;
}

export function clearedFieldsTip(fields: string[]): string {
  return `Will clear: ${fields.join(", ")}`;
}
