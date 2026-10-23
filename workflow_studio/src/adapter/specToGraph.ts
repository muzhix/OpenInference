/**
 * spec -> React Flow graph. The spec is the single source of truth; nodes and
 * edges are the transitive reduction of selector references (03 §1, 04 §1).
 * Node ids: "$inputs",
 * "$steps.<name>", "$outputs", "note:<id>". Edge ids:
 * `${source}~${out}~${target}~${in}`. Handles are node-level (cloud builder):
 * source = bottom "out", target = top "in"; the per-reference detail rides in
 * each edge's `data`.
 */

import { MarkerType } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";

import { blockSectionOf } from "./category";
import { flowEdges, makeEdgeId, SOURCE_HANDLE_ID, TARGET_HANDLE_ID } from "./edges";
import type { AppEdgeData } from "./edges";
import { computeAutoLayout } from "./layout";
import { collectSelectorStrings } from "./selectors";
import { findBlock, selectorPropertiesForBlock } from "./registryUtils";
import { findDanglingReferences } from "./validation";

import type { BlockDescriptor, BlockRegistry } from "../types/registry";
import type { UiNote, WorkflowInputSpec, WorkflowOutputSpec, WorkflowSpecification, WorkflowStepSpec } from "../types/spec";
import { stepsToList } from "../types/spec";

export type StepNodeData = {
  kind: "step";
  stepName: string;
  step: WorkflowStepSpec;
  block: BlockDescriptor | null;
  /** Selector-typed params (registry kind connections + heuristics + params bound to selectors). */
  selectorProps: string[];
  /** Known output names (registry manifest, else outputs referenced elsewhere in the spec). */
  outputNames: string[];
  /** Registry outputs manifest entries for the selected-state side tray. */
  outputEntries: { name: string }[];
  /** Cloud section id (CLOUD_BLOCKS) driving the accent color. */
  section: string;
  disabled: boolean;
  hasDanglingRef: boolean;
};

export type InputNodeData = {
  kind: "input";
  inputs: WorkflowInputSpec[];
};

export type OutputNodeData = {
  kind: "output";
  outputs: WorkflowOutputSpec[];
  /** Output rows whose selector is dangling (shown red in the card). */
  danglingOutputs: string[];
};

export type NoteNodeData = {
  kind: "note";
  note: UiNote;
};

/** Transient card shown between two nodes while the user picks a block to insert. */
export type InsertNodeData = {
  kind: "insert";
};

export type WorkflowNodeData = StepNodeData | InputNodeData | OutputNodeData | NoteNodeData | InsertNodeData;
export type AppNode = Node<WorkflowNodeData>;
export type AppEdge = Edge<AppEdgeData>;

export interface DerivedGraph {
  nodes: AppNode[];
  edges: AppEdge[];
}

/** Gray connection. The canvas edge draws it as a flowing dash; the marker matches. */
const DEFAULT_EDGE_STYLE = { stroke: "#C4C7CE", strokeWidth: 1.5 };
const DANGLING_EDGE_STYLE = { stroke: "#DC2626", strokeWidth: 1.5 };
const EDGE_MARKER_END = { type: MarkerType.ArrowClosed, width: 12, height: 12, color: "#B4B8C0" };

export function specToGraph(spec: WorkflowSpecification, registry?: BlockRegistry | null): DerivedGraph {
  const storedPositions = spec.metadata?.ui?.nodes ?? {};
  const disabledKeys = new Set(spec.metadata?.ui?.disabled ?? []);
  const dangling = findDanglingReferences(spec);
  const danglingByConsumer = new Set(dangling.map((ref) => ref.consumer));

  const entries = stepsToList(spec.steps);
  const nodeIds = ["$inputs", ...entries.map((entry) => `$steps.${entry.name}`), "$outputs"];
  const missingIds = nodeIds.filter((id) => !storedPositions[id]);
  const autoLayout = missingIds.length > 0 ? computeAutoLayout(spec, nodeIds) : null;
  const positionFor = (id: string): { x: number; y: number } =>
    storedPositions[id] ?? autoLayout?.[id] ?? { x: 0, y: 0 };

  const blocksByStep = new Map(
    entries.map(({ step }) => [step.type, findBlock(registry, step.type)] as const),
  );
  const referencedOutputs = collectReferencedOutputs(spec);
  const danglingOutputSelectors = new Set(
    dangling.filter((ref) => ref.consumer === "$outputs").map((ref) => ref.selector),
  );

  const nodes: AppNode[] = [
    {
      id: "$inputs",
      type: "workflowInput",
      position: positionFor("$inputs"),
      data: { kind: "input", inputs: spec.inputs ?? [] },
    },
    ...entries.map(({ name, step }): AppNode => {
      const block = blocksByStep.get(step.type) ?? null;
      const manifestOutputs = block?.outputs_manifest ?? [];
      const registryOutputs = manifestOutputs.map((output) => output.name);
      const outputNames = registryOutputs.length > 0 ? registryOutputs : (referencedOutputs.get(name) ?? []);
      const selectorProps = selectorPropertiesForBlock(registry, step.type);
      const boundSelectors = Object.entries(step)
        .filter(([property, value]) => {
          if (property === "type" || property === "name") {
            return false;
          }
          return collectSelectorStrings(value).length > 0 && !selectorProps.includes(property);
        })
        .map(([property]) => property);
      return {
        id: `$steps.${name}`,
        type: "workflowStep",
        position: positionFor(`$steps.${name}`),
        data: {
          kind: "step",
          stepName: name,
          step,
          block,
          selectorProps: [...new Set([...selectorProps, ...boundSelectors])].sort(),
          outputNames,
          outputEntries: manifestOutputs.map((output) => ({ name: output.name })),
          section: blockSectionOf(step.type),
          disabled: disabledKeys.has(`$steps.${name}`),
          hasDanglingRef: danglingByConsumer.has(`$steps.${name}`),
        },
      };
    }),
    {
      id: "$outputs",
      type: "workflowOutput",
      position: positionFor("$outputs"),
      data: {
        kind: "output",
        outputs: spec.outputs ?? [],
        danglingOutputs: (spec.outputs ?? [])
          .filter((output) => danglingOutputSelectors.has(output.selector))
          .map((output) => output.name),
      },
    },
    ...(spec.metadata?.ui?.notes ?? []).map((note): AppNode => ({
      id: `note:${note.id}`,
      type: "stickyNote",
      position: { x: note.x, y: note.y },
      data: { kind: "note", note },
    })),
  ];

  const edges: AppEdge[] = flowEdges(spec).map((edge) => ({
    id: makeEdgeId(edge),
    source: edge.source,
    sourceHandle: SOURCE_HANDLE_ID,
    target: edge.target,
    targetHandle: TARGET_HANDLE_ID,
    data: { sourceOutput: edge.sourceOutput, targetInput: edge.targetInput },
    style: isEdgeToUnknownOutput(edge, entries, blocksByStep) ? DANGLING_EDGE_STYLE : DEFAULT_EDGE_STYLE,
      markerEnd: EDGE_MARKER_END,
  }));

  return { nodes, edges };
}

/** Best-effort dangling indicator: edge references an output the source block does not declare. */function isEdgeToUnknownOutput(
  edge: { source: string; sourceOutput: string },
  entries: ReturnType<typeof stepsToList>,
  blocksByStep: Map<string, BlockDescriptor | null | undefined>,
): boolean {
  if (!edge.source.startsWith("$steps.")) {
    return false;
  }
  const stepName = edge.source.slice("$steps.".length);
  const entry = entries.find((item) => item.name === stepName);
  if (!entry) {
    return false;
  }
  const outputs = blocksByStep.get(entry.step.type)?.outputs_manifest ?? [];
  if (outputs.length === 0) {
    return false;
  }
  const names = outputs.map((output) => output.name);
  const bindsEveryProperty = edge.sourceOutput === "*" || edge.sourceOutput.startsWith("all_properties");
  return !names.includes(edge.sourceOutput) && !bindsEveryProperty;
}

/** Output names referenced anywhere in the spec, per step name (registry-less fallback). */
function collectReferencedOutputs(spec: WorkflowSpecification): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const add = (stepName: string, outputName: string): void => {
    const list = result.get(stepName) ?? [];
    if (!list.includes(outputName)) {
      list.push(outputName);
      result.set(stepName, list);
    }
  };
  const consume = (value: string): void => {
    const match = /^\$steps\.([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)/.exec(value);
    if (match) {
      add(match[1]!, match[2]!);
    }
  };
  for (const { step } of stepsToList(spec.steps)) {
    for (const value of Object.values(step)) {
      for (const selectorString of collectSelectorStrings(value)) {
        consume(selectorString);
      }
    }
  }
  for (const output of spec.outputs ?? []) {
    if (output.selector) {
      consume(output.selector);
    }
  }
  return result;
}
