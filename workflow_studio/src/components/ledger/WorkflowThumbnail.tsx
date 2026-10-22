/**
 * Read-only card thumbnail: a compact React Flow render of the workflow spec
 * built through the shared adapter (01 §2, 13 §2). States: loading preview
 * text, error fallback, empty-spec guidance ("To Get Started / Add a Model")
 * and the mini canvas itself.
 */

import { useMemo } from "react";
import { ReactFlow } from "@xyflow/react";
import type { Edge } from "@xyflow/react";

import { blockShortName, specToGraph } from "../../adapter";
import type { AppNode } from "../../adapter";
import { stepsToList } from "../../types/spec";
import type { WorkflowSpecification } from "../../types/spec";
import type { SpecState } from "../../state/ledgerStore";
import { MiniNode } from "./MiniNode";
import type { MiniAppNode } from "./MiniNode";

const MINI_NODE_TYPES = { mini: MiniNode };

const MINI_NODE_HEIGHT = 22;

/** Rough char-width estimate so fitView works before the first DOM measure. */
function estimateNodeWidth(label: string): number {
  return Math.max(52, Math.round(label.length * 6.5) + 22);
}

/** True when the spec has no steps: the ledger empty-state guidance applies. */
export function isEmptySpec(spec: WorkflowSpecification | null): boolean {
  return !spec || stepsToList(spec.steps).length === 0;
}

/** Map the adapter graph to compact mini nodes (edges are kept as derived). */
export function toMiniGraph(
  spec: WorkflowSpecification,
): { nodes: MiniAppNode[]; edges: Edge[] } {
  const graph = specToGraph(spec);
  const nodes: MiniAppNode[] = graph.nodes
    .filter((node: AppNode) => node.data.kind !== "note")
    .map((node: AppNode) => {
      const label =
        node.data.kind === "input"
          ? "Inputs"
          : node.data.kind === "output"
            ? "Outputs"
            : node.data.kind === "step"
              ? blockShortName(node.data.step.type)
              : "";
      return {
        id: node.id,
        type: "mini" as const,
        position: node.position,
        data: { label },
        style: { width: estimateNodeWidth(label), height: MINI_NODE_HEIGHT },
      };
    });
  return { nodes, edges: graph.edges };
}

export function WorkflowThumbnail({
  spec,
  state,
}: {
  spec: WorkflowSpecification | null;
  state: SpecState;
}) {
  const mini = useMemo(() => (spec ? toMiniGraph(spec) : null), [spec]);

  if (state === "loading") {
    return (
      <p className="flex h-full items-center justify-center text-xs text-gray-500" aria-live="polite">
        Loading workflow preview
      </p>
    );
  }
  if (state === "error" || !spec || !mini) {
    return (
      <p className="flex h-full items-center justify-center text-xs text-gray-500" aria-live="polite">
        Preview unavailable
      </p>
    );
  }
  if (isEmptySpec(spec)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm font-medium text-gray-500">To Get Started</p>
        <p className="text-xs text-gray-400">Add a Model</p>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={mini.nodes}
      edges={mini.edges}
      nodeTypes={MINI_NODE_TYPES}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag={false}
      zoomOnScroll={false}
      preventScrolling={false}
      fitView
      fitViewOptions={{ padding: 0.2, maxZoom: 1.4 }}
      minZoom={0.05}
      proOptions={{ hideAttribution: true }}
      aria-label={`Preview of workflow graph with ${mini.nodes.length} nodes`}
    />
  );
}
