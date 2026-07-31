import type { Edge, Node } from "@xyflow/react";
import type { BlockDescription, WorkflowSpecification } from "./api";

export type StepNodeData = {
  label: string;
  blockType: string;
  params: Record<string, unknown>;
  outputs: string[];
  airGappedUnavailable?: boolean;
};

export function airGappedUnavailable(block: BlockDescription): boolean {
  const schema = block.block_schema as {
    air_gapped_info?: { available?: boolean };
  };
  return schema?.air_gapped_info?.available === false;
}

export function defaultParamsForBlock(
  block: BlockDescription,
): Record<string, unknown> {
  const schema = block.block_schema as {
    properties?: Record<string, { default?: unknown; type?: unknown }>;
    required?: string[];
  };
  const params: Record<string, unknown> = {};
  const props = schema.properties || {};
  for (const [key, prop] of Object.entries(props)) {
    if (key === "type" || key === "name") continue;
    if (prop.default !== undefined) params[key] = prop.default;
  }
  return params;
}

export function outputNames(block: BlockDescription): string[] {
  return (block.outputs_manifest || []).map((o) => o.name);
}

/** Build EE-compatible specification from canvas graph. */
export function canvasToSpecification(
  nodes: Node<StepNodeData>[],
  edges: Edge[],
): WorkflowSpecification {
  const steps = nodes.map((node) => {
    const step: Record<string, unknown> = {
      type: node.data.blockType,
      name: node.id,
      ...node.data.params,
    };
    for (const edge of edges.filter((e) => e.target === node.id)) {
      const prop = edge.targetHandle || "image";
      const sourceOut = edge.sourceHandle || "predictions";
      // Input nodes use id "input:<name>"
      if (edge.source.startsWith("input:")) {
        step[prop] = `$inputs.${edge.source.slice("input:".length)}`;
      } else {
        step[prop] = `$steps.${edge.source}.${sourceOut}`;
      }
    }
    return step;
  });

  const outputs: Record<string, unknown>[] = [];
  for (const node of nodes) {
    for (const out of node.data.outputs) {
      outputs.push({
        type: "JsonField",
        name: `${node.id}__${out}`,
        selector: `$steps.${node.id}.${out}`,
      });
    }
  }
  if (outputs.length === 0) {
    outputs.push({
      type: "JsonField",
      name: "result",
      selector: nodes[0] ? `$steps.${nodes[0].id}` : "$inputs.image",
    });
  }

  return {
    version: "1.0",
    inputs: [{ type: "WorkflowImage", name: "image" }],
    steps,
    outputs,
  };
}

export function specificationToCanvas(
  spec: WorkflowSpecification,
  blocksByType: Map<string, BlockDescription>,
): { nodes: Node<StepNodeData>[]; edges: Edge[] } {
  const nodes: Node<StepNodeData>[] = [];
  const edges: Edge[] = [];
  let x = 80;
  for (const step of spec.steps || []) {
    const name = String(step.name || `step_${nodes.length}`);
    const blockType = String(step.type || "");
    const block = blocksByType.get(blockType);
    const params = { ...step };
    delete params.type;
    delete params.name;
    // Strip selector wires — restored as edges
    const wireKeys: string[] = [];
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === "string" && (v.startsWith("$inputs.") || v.startsWith("$steps."))) {
        wireKeys.push(k);
        const sel = v as string;
        if (sel.startsWith("$inputs.")) {
          edges.push({
            id: `e-${sel}-${name}-${k}`,
            source: `input:${sel.slice("$inputs.".length)}`,
            target: name,
            targetHandle: k,
            sourceHandle: "value",
          });
        } else {
          // $steps.foo.bar
          const rest = sel.slice("$steps.".length);
          const dot = rest.indexOf(".");
          const source = dot >= 0 ? rest.slice(0, dot) : rest;
          const sourceHandle = dot >= 0 ? rest.slice(dot + 1) : "predictions";
          edges.push({
            id: `e-${source}-${name}-${k}`,
            source,
            target: name,
            targetHandle: k,
            sourceHandle,
          });
        }
      }
    }
    for (const k of wireKeys) delete params[k];

    nodes.push({
      id: name,
      type: "step",
      position: { x, y: 120 },
      data: {
        label: block?.human_friendly_block_name || name,
        blockType,
        params,
        outputs: block ? outputNames(block) : ["predictions"],
        airGappedUnavailable: block ? airGappedUnavailable(block) : false,
      },
    });
    x += 260;
  }
  return { nodes, edges };
}

export function slugId(prefix = "wf"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}
