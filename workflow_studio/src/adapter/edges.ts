/**
 * Selector references are data bindings. The canvas draws the transitive
 * reduction of that graph: a reference gets no line when another path already
 * reaches the same node. Downstream steps can still read any ancestor output.
 */

import { collectSelectorStrings, parseSelector } from "./selectors";

import type { WorkflowSpecification } from "../types/spec";
import { stepsToList } from "../types/spec";

export interface DerivedEdge {
  /** Source node id: "$inputs" | "$steps.<name>". */
  source: string;
  /** Output/input name on the source (kept in edge data; handles are node-level). */
  sourceOutput: string;
  /** Target node id: "$steps.<name>" | "$outputs". */
  target: string;
  /** Consuming property / output name (kept in edge data; handles are node-level). */
  targetInput: string;
}

export interface EdgeBinding {
  sourceOutput: string;
  targetInput: string;
}

/** Data carried on rendered edges so deletions can be mapped back to the reference. */
export interface AppEdgeData {
  sourceOutput: string;
  targetInput: string;
  /** Every reference drawn as this one visual connection (same source and target). */
  bindings?: EdgeBinding[];
  /** Segment drawn only while a block is being inserted. No hover actions. */
  inert?: boolean;
  [extra: string]: unknown;
}

/** Node-level handles (observed on the cloud builder): one per node side. */
export const SOURCE_HANDLE_ID = "out";
export const TARGET_HANDLE_ID = "in";

export const INPUTS_NODE_ID = "$inputs";
export const OUTPUTS_NODE_ID = "$outputs";

export function stepNodeId(stepName: string): string {
  return `$steps.${stepName}`;
}

export function makeEdgeId(edge: DerivedEdge): string {
  return `${edge.source}~${edge.sourceOutput}~${edge.target}~${edge.targetInput}`;
}

/** Anything shaped like a rendered edge (id + data) whose reference we need to recover. */
export interface DisconnectibleEdge {
  id?: string;
  source?: string | null;
  target?: string | null;
  data?: unknown;
}

/**
 * Recover the semantic reference behind a rendered edge, preferring the edge's
 * stored `data` and falling back to its `source~output~target~input` id.
 */
export function edgeReferenceOf(edge: DisconnectibleEdge): DerivedEdge | null {
  const data = (edge.data ?? null) as Partial<AppEdgeData> | null;
  const source = edge.source ?? undefined;
  const target = edge.target ?? undefined;
  if (source && target && typeof data?.sourceOutput === "string" && typeof data?.targetInput === "string") {
    return { source, sourceOutput: data.sourceOutput, target, targetInput: data.targetInput };
  }
  if (edge.id) {
    const [idSource, sourceOutput, idTarget, targetInput] = edge.id.split("~");
    if (idSource && sourceOutput && idTarget && targetInput) {
      return { source: idSource, sourceOutput, target: idTarget, targetInput };
    }
  }
  return null;
}

/**
 * Derive every semantic edge from spec references: step params bound to
 * selectors (including selectors nested in arrays/dicts) plus output rows.
 * Edges whose source node does not exist (dangling references) are omitted;
 * the validator reports those separately.
 */
export function deriveEdges(spec: WorkflowSpecification): DerivedEdge[] {
  const edges = new Map<string, DerivedEdge>();
  const stepNames = new Set(stepsToList(spec.steps).map((entry) => entry.name));
  const inputNames = new Set((spec.inputs ?? []).map((input) => input.name));

  const pushEdge = (edge: DerivedEdge): void => {
    edges.set(makeEdgeId(edge), edge);
  };

  /** Referenced input name for $inputs sources, else the step output name. */
  const sourceOutputOf = (parsed: ReturnType<typeof parseSelector>): string | null => {
    if (!parsed) {
      return null;
    }
    if (parsed.scope === "inputs") {
      return parsed.inputName ?? null;
    }
    return parsed.outputName ?? null;
  };

  for (const { name, step } of stepsToList(spec.steps)) {
    for (const [property, value] of Object.entries(step)) {
      if (property === "type" || property === "name") {
        continue;
      }
      for (const selectorString of collectSelectorStrings(value)) {
        const parsed = parseSelector(selectorString);
        const sourceOutput = sourceOutputOf(parsed);
        if (!parsed || !sourceOutput) {
          continue;
        }
        const exists =
          parsed.scope === "inputs"
            ? inputNames.has(parsed.inputName ?? "")
            : stepNames.has(parsed.stepName ?? "");
        if (!exists) {
          continue;
        }
        pushEdge({
          source: parsed.sourceNodeId,
          sourceOutput,
          target: stepNodeId(name),
          targetInput: property,
        });
      }
    }
  }

  for (const output of spec.outputs ?? []) {
    if (!output.selector) {
      continue;
    }
    const parsed = parseSelector(output.selector);
    const sourceOutput = sourceOutputOf(parsed);
    if (!parsed || !sourceOutput) {
      continue;
    }
    const exists =
      parsed.scope === "inputs"
        ? inputNames.has(parsed.inputName ?? "")
        : stepNames.has(parsed.stepName ?? "");
    if (!exists) {
      continue;
    }
    pushEdge({
      source: parsed.sourceNodeId,
      sourceOutput,
      target: OUTPUTS_NODE_ID,
      targetInput: output.name,
    });
  }

  return [...edges.values()];
}

/**
 * Edges to draw and to lay out. Drops `source → target` when `target` is
 * already reachable from `source` without that pair, matching the cloud
 * builder (`connectDirectly` skips an existing path, then prunes redundant
 * `metadata.ui.edges`). Every direct binding on a kept pair is preserved.
 */
export function flowEdges(spec: WorkflowSpecification): DerivedEdge[] {
  return reduceFlowEdges(deriveEdges(spec));
}

function reduceFlowEdges(edges: DerivedEdge[]): DerivedEdge[] {
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (edge.source === edge.target) {
      continue;
    }
    const next = adjacency.get(edge.source) ?? new Set<string>();
    next.add(edge.target);
    adjacency.set(edge.source, next);
  }
  const redundant = new Set<string>();
  for (const [source, targets] of adjacency) {
    for (const target of targets) {
      if (reachableWithoutDirect(adjacency, source, target)) {
        redundant.add(`${source}\0${target}`);
      }
    }
  }
  return edges.filter((edge) => !redundant.has(`${edge.source}\0${edge.target}`));
}

/** True when `target` is reachable from `source` without the direct edge. */
function reachableWithoutDirect(
  adjacency: Map<string, Set<string>>,
  source: string,
  target: string,
): boolean {
  const seen = new Set<string>([source]);
  const queue: string[] = [];
  for (const next of adjacency.get(source) ?? []) {
    if (next !== target && !seen.has(next)) {
      seen.add(next);
      queue.push(next);
    }
  }
  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) {
      break;
    }
    for (const next of adjacency.get(node) ?? []) {
      if (next === target) {
        return true;
      }
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

/**
 * `nodeId` plus every node reached by following references forward.
 * Those outputs are not sources for this node: a step may read ancestors and
 * unrelated blocks, and must not read its own successors.
 */
export function downstreamNodeIds(spec: WorkflowSpecification, nodeId: string): Set<string> {
  const adjacency = new Map<string, Set<string>>();
  for (const edge of deriveEdges(spec)) {
    if (edge.source === edge.target) {
      continue;
    }
    const next = adjacency.get(edge.source) ?? new Set<string>();
    next.add(edge.target);
    adjacency.set(edge.source, next);
  }
  const downstream = new Set<string>([nodeId]);
  const queue = [nodeId];
  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) {
      break;
    }
    for (const next of adjacency.get(node) ?? []) {
      if (!downstream.has(next)) {
        downstream.add(next);
        queue.push(next);
      }
    }
  }
  return downstream;
}
