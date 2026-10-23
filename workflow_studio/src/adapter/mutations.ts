/**
 * Spec mutations. Every mutation is a pure function returning a NEW spec
 * (immutable updates), which makes undo/redo a stack of spec snapshots.
 */

import { blockShortName } from "./category";
import { deriveEdges, edgeReferenceOf, INPUTS_NODE_ID, OUTPUTS_NODE_ID, stepNodeId } from "./edges";
import type { AppEdgeData, DerivedEdge, DisconnectibleEdge } from "./edges";
import {
  HEURISTIC_SELECTOR_PROPERTIES,
  acceptedKindsForProperty,
  blockOutputs,
  findBlock,
  imageInputPropertyForBlock,
  kindsMatch,
  selectorPropertiesForBlock,
} from "./registryUtils";
import {
  rewriteStepReferences,
  rewriteInputReferences,
  parseSelector,
  collectSelectorStrings,
  canonicalOutputSelector,
} from "./selectors";

import type { BlockDescriptor, BlockRegistry, OutputManifestEntry } from "../types/registry";
import type { UiNote, UiPosition, WorkflowInputSpec, WorkflowSpecification, WorkflowStepSpec } from "../types/spec";
import { inputKindName, isImageInputType, stepsToList } from "../types/spec";

function uniqueName(existing: Iterable<string>, base: string): string {
  const taken = new Set(existing);
  if (!taken.has(base)) {
    return base;
  }
  let counter = 1;
  while (taken.has(`${base}-${counter}`)) {
    counter += 1;
  }
  return `${base}-${counter}`;
}

/** "roboflow_core/roboflow_label_visualization@v1" -> "label_visualization" (deduped "-1"/"-2" style). */
export function generateStepName(spec: WorkflowSpecification, blockType: string): string {
  return uniqueName(
    stepsToList(spec.steps).map((entry) => entry.name),
    blockShortName(blockType),
  );
}

function withSteps(spec: WorkflowSpecification, steps: WorkflowStepSpec[]): WorkflowSpecification {
  return { ...spec, steps };
}

function withOutputs(spec: WorkflowSpecification, outputs: WorkflowSpecification["outputs"]): WorkflowSpecification {
  return { ...spec, outputs };
}

function updateUi(
  spec: WorkflowSpecification,
  updater: (ui: NonNullable<NonNullable<WorkflowSpecification["metadata"]>["ui"]>) => NonNullable<NonNullable<WorkflowSpecification["metadata"]>["ui"]>,
): WorkflowSpecification {
  const ui = spec.metadata?.ui ?? {};
  return { ...spec, metadata: { ...(spec.metadata ?? {}), ui: updater({ ...ui }) } };
}

/** Add a step; auto-binds the primary image input and auto-creates `<step>_output` (03 §4). */
export function addStep(
  spec: WorkflowSpecification,
  blockType: string,
  name: string | undefined,
  position: UiPosition,
  registry?: BlockRegistry | null,
): WorkflowSpecification {
  const stepName = name ?? generateStepName(spec, blockType);
  const step: WorkflowStepSpec = { type: blockType, name: stepName };

  const imageProperty = imageInputPropertyForBlock(registry, blockType);
  const imageInput = (spec.inputs ?? []).find((input) => input.name === "image" && isImageInputType(input.type))
    ?? (spec.inputs ?? []).find((input) => isImageInputType(input.type));
  if (imageProperty && imageInput && step[imageProperty] === undefined) {
    step[imageProperty] = `$inputs.${imageInput.name}`;
  }

  let next = withSteps(spec, [...stepsToList(spec.steps).map((entry) => ({ ...entry.step })), step]);

  const firstOutput = registry ? blockOutputs(registry, blockType)[0]?.name : undefined;
  if (firstOutput) {
    const selector = `$steps.${stepName}.${firstOutput}`;
    const alreadyBound = (spec.outputs ?? []).some((output) => output.selector === selector);
    if (!alreadyBound) {
      next = withOutputs(next, [
        ...(next.outputs ?? []),
        { type: "JsonField", name: `${stepName}_output`, selector },
      ]);
    }
  }

  return setNodePosition(next, stepNodeId(stepName), position.x, position.y);
}

/** Remove a node. Structural nodes ($inputs/$outputs) are preserved. */
export function removeNode(spec: WorkflowSpecification, nodeKey: string): WorkflowSpecification {
  if (nodeKey.startsWith("note:")) {
    return removeNote(spec, nodeKey.slice("note:".length));
  }
  if (!nodeKey.startsWith("$steps.")) {
    return spec;
  }
  const stepName = nodeKey.slice("$steps.".length);
  let next = withSteps(
    spec,
    stepsToList(spec.steps)
      .filter((entry) => entry.name !== stepName)
      .map((entry) => ({ ...entry.step })),
  );
  next = updateUi(next, (ui) => {
    const nodes = { ...ui.nodes };
    delete nodes[nodeKey];
    return {
      ...ui,
      nodes,
      disabled: (ui.disabled ?? []).filter((key) => key !== nodeKey),
    };
  });
  return next;
}

/** Rename a step, rewriting every selector that references the old name. */
export function renameStep(spec: WorkflowSpecification, oldName: string, newName: string): WorkflowSpecification {
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName) {
    return spec;
  }
  const names = stepsToList(spec.steps).map((entry) => entry.name);
  if (names.includes(trimmed)) {
    return spec;
  }

  const steps = stepsToList(spec.steps).map(({ step }) => {
    const nextStep: WorkflowStepSpec = { ...step };
    for (const [property, value] of Object.entries(step)) {
      if (property === "type") {
        continue;
      }
      if (property === "name") {
        nextStep.name = value === oldName ? trimmed : String(value);
        continue;
      }
      nextStep[property] = rewriteStepReferences(value, oldName, trimmed);
    }
    return nextStep;
  });

  const outputs = (spec.outputs ?? []).map((output) => ({
    ...output,
    selector: rewriteStepReferences(output.selector, oldName, trimmed) as string,
  }));

  const oldKey = stepNodeId(oldName);
  const newKey = stepNodeId(trimmed);
  return updateUi({ ...spec, steps, outputs }, (ui) => {
    const nodes = { ...ui.nodes };
    const position = nodes[oldKey];
    if (position) {
      delete nodes[oldKey];
      nodes[newKey] = position;
    }
    return {
      ...ui,
      nodes,
      disabled: (ui.disabled ?? []).map((key) => (key === oldKey ? newKey : key)),
    };
  });
}

/** Set one parameter on a step; undefined removes the parameter. */
export function setParam(
  spec: WorkflowSpecification,
  stepName: string,
  property: string,
  value: unknown,
): WorkflowSpecification {
  const steps = stepsToList(spec.steps).map(({ name, step }) => {
    if (name !== stepName) {
      return { ...step };
    }
    const nextStep: WorkflowStepSpec = { ...step };
    if (value === undefined) {
      delete nextStep[property];
    } else {
      nextStep[property] = value;
    }
    return nextStep;
  });
  return withSteps(spec, steps);
}

/** Selector-typed image-ish properties a connection may replace when nothing is unset. */
const PRIMARY_IMAGE_PROPERTIES = ["image", "images", "data"];

interface ConnectionSource {
  selector: string;
  /** Kind name of the chosen source output; null when unknown (treated as compatible). */
  kindName: string | null;
}

/**
 * The reference a drag from `sourceNodeKey` carries: `$inputs.<name>` for the
 * inputs node (its single image-ish input, else the first declared input), or
 * `$steps.<name>.<firstOutput>` (registry outputs_manifest first output, else
 * the first output referenced elsewhere in the spec).
 */
export function sourceConnectionFor(
  spec: WorkflowSpecification,
  sourceNodeKey: string,
  registry?: BlockRegistry | null,
): ConnectionSource | null {
  if (sourceNodeKey === "$inputs") {
    const inputs = spec.inputs ?? [];
    const chosen = inputs.find((input) => isImageInputType(input.type)) ?? inputs[0];
    if (!chosen) {
      return null;
    }
    return { selector: `$inputs.${chosen.name}`, kindName: inputKindName(chosen.type) };
  }
  if (!sourceNodeKey.startsWith("$steps.")) {
    return null;
  }
  const stepName = sourceNodeKey.slice("$steps.".length);
  const entry = stepsToList(spec.steps).find((item) => item.name === stepName);
  if (!entry) {
    return null;
  }
  const firstOutput = blockOutputs(registry, entry.step.type)[0];
  if (firstOutput) {
    return { selector: `$steps.${stepName}.${firstOutput.name}`, kindName: firstOutput.kind[0]?.name ?? null };
  }
  const referenced = firstReferencedOutputName(spec, stepName);
  if (referenced) {
    return { selector: `$steps.${stepName}.${referenced}`, kindName: null };
  }
  return null;
}

/** First `$steps.<name>.<output>` output referenced anywhere in the spec (registry-less fallback). */
function firstReferencedOutputName(spec: WorkflowSpecification, stepName: string): string | null {
  const consume = (value: unknown): string | null => {
    for (const selectorString of collectSelectorStrings(value)) {
      const parsed = parseSelector(selectorString);
      if (parsed?.scope === "steps" && parsed.stepName === stepName && parsed.outputName) {
        return parsed.outputName;
      }
    }
    return null;
  };
  for (const { step } of stepsToList(spec.steps)) {
    for (const [property, value] of Object.entries(step)) {
      if (property === "type" || property === "name") {
        continue;
      }
      const found = consume(value);
      if (found) {
        return found;
      }
    }
  }
  for (const output of spec.outputs ?? []) {
    const found = consume(output.selector);
    if (found) {
      return found;
    }
  }
  return null;
}

/** Compatible when either side is unknown, or the provided kind feeds a required kind. */
function kindCompatible(requiredKinds: string[], provided: string | null): boolean {
  if (provided === null || requiredKinds.length === 0) {
    return true;
  }
  return requiredKinds.some((kind) => kindsMatch(kind, provided));
}

/**
 * Selector properties of the target block, ordered by schema declaration
 * order. When the block descriptor is unavailable (registry-less), fall back
 * to the heuristic selector property names.
 */
function orderedSelectorProperties(
  registry: BlockRegistry | null | undefined,
  block: BlockDescriptor | null,
  manifestType: string,
): string[] {
  const declared = selectorPropertiesForBlock(registry, manifestType).sort();
  const schemaKeys = Object.keys(block?.block_schema?.properties ?? {}).filter(
    (key) => key !== "type" && key !== "name",
  );
  if (schemaKeys.length === 0) {
    return declared;
  }
  return schemaKeys.filter((key) => declared.includes(key));
}

function isUnsetValue(value: unknown): boolean {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

/**
 * Connect two nodes (edge drag): bind ONE property on the target step — the
 * first selector-typed property that is currently unset and kind-compatible
 * with the chosen source output; when everything is set, replace the block's
 * primary image-ish selector property (image/images/data). Dragging into the
 * outputs node appends a new JsonField row bound to the source selector.
 * No-op (same spec returned) on self-connection, unknown nodes, or a target
 * without selector properties.
 */
export function connectNodes(
  spec: WorkflowSpecification,
  sourceNodeKey: string,
  targetNodeKey: string,
  registry?: BlockRegistry | null,
): WorkflowSpecification {
  if (!sourceNodeKey || !targetNodeKey || sourceNodeKey === targetNodeKey) {
    return spec;
  }
  const source = sourceConnectionFor(spec, sourceNodeKey, registry);
  if (!source) {
    return spec;
  }

  if (targetNodeKey === OUTPUTS_NODE_ID) {
    const baseName =
      sourceNodeKey === "$inputs"
        ? (spec.inputs ?? []).find((input) => `$inputs.${input.name}` === source.selector)?.name ?? "input"
        : sourceNodeKey.slice("$steps.".length);
    const name = nextOutputName((spec.outputs ?? []).map((output) => output.name), baseName);
    return withOutputs(spec, [...(spec.outputs ?? []), { type: "JsonField", name, selector: source.selector }]);
  }

  if (!targetNodeKey.startsWith("$steps.")) {
    return spec;
  }
  const targetName = targetNodeKey.slice("$steps.".length);
  const entry = stepsToList(spec.steps).find((item) => item.name === targetName);
  if (!entry) {
    return spec;
  }
  const candidates = orderedSelectorProperties(registry, findBlock(registry, entry.step.type), entry.step.type);
  if (candidates.length === 0) {
    return spec;
  }
  const property =
    candidates.find((candidate) => {
      if (!isUnsetValue(entry.step[candidate])) {
        return false;
      }
      return kindCompatible(acceptedKindsForProperty(registry, entry.step.type, candidate), source.kindName);
    }) ?? PRIMARY_IMAGE_PROPERTIES.find((candidate) => candidates.includes(candidate));
  if (!property) {
    return spec;
  }
  return setParam(spec, targetName, property, source.selector);
}

/**
 * Drop every reference drawn as one visual connection. A grouped edge carries
 * `data.bindings`; a single reference falls through to `disconnectEdge`.
 */
export function disconnectConnection(spec: WorkflowSpecification, edge: DisconnectibleEdge): WorkflowSpecification {
  const data = (edge.data ?? null) as AppEdgeData | null;
  const bindings = data?.bindings ?? [];
  if (bindings.length === 0) {
    return disconnectEdge(spec, edge);
  }
  return bindings.reduce(
    (acc, binding) => disconnectEdge(acc, { ...edge, data: { ...data, ...binding } }),
    spec,
  );
}

/** Remove the binding that produced a rendered edge: clear the step property holding the reference, or drop the outputs[] row. */
export function disconnectEdge(spec: WorkflowSpecification, edge: DisconnectibleEdge): WorkflowSpecification {
  const reference = edgeReferenceOf(edge);
  if (!reference) {
    return spec;
  }
  if (reference.target === OUTPUTS_NODE_ID) {
    return removeOutput(spec, reference.targetInput);
  }
  if (reference.target.startsWith("$steps.")) {
    return setParam(spec, reference.target.slice("$steps.".length), reference.targetInput, undefined);
  }
  return spec;
}

/** Geometry for inserting a block on the connection between two nodes. */
export interface InsertSlot {
  sourceId: string;
  targetId: string;
  position: UiPosition;
  /** Existing nodes moved down so the new card keeps a one-card gap. */
  shiftedPositions: Record<string, UiPosition>;
}

/**
 * Insert a block on the connection `sourceId → targetId`. That connection is
 * replaced: the new block is fed by the selectors that used to arrive on the
 * edge, and every downstream field on the edge is retargeted at the new block.
 */
export function spliceBlock(
  spec: WorkflowSpecification,
  manifestType: string,
  slot: InsertSlot,
  registry?: BlockRegistry | null,
): WorkflowSpecification {
  const bindings = deriveEdges(spec).filter(
    (edge) => edge.source === slot.sourceId && edge.target === slot.targetId,
  );
  let next = applyNodePositions(spec, slot.shiftedPositions);
  const stepName = generateStepName(next, manifestType);
  next = addStep(next, manifestType, stepName, slot.position, registry);
  next = feedInsertedStep(next, stepName, manifestType, bindings, slot.sourceId, registry);
  return rebindPastInsert(next, stepName, manifestType, bindings, registry);
}

function bindingSelector(edge: DerivedEdge): string {
  if (edge.source === INPUTS_NODE_ID) {
    return `$inputs.${edge.sourceOutput}`;
  }
  return `${edge.source}.${edge.sourceOutput}`;
}

/** Copy this edge's selectors onto matching inputs of the inserted step. */
function stepAcceptsSelector(
  registry: BlockRegistry | null | undefined,
  manifestType: string,
  property: string,
): boolean {
  if (acceptedKindsForProperty(registry, manifestType, property).length > 0) {
    return true;
  }
  const properties = findBlock(registry, manifestType)?.block_schema?.properties ?? {};
  return property in properties && HEURISTIC_SELECTOR_PROPERTIES.has(property);
}

function feedInsertedStep(
  spec: WorkflowSpecification,
  stepName: string,
  manifestType: string,
  bindings: DerivedEdge[],
  sourceId: string,
  registry?: BlockRegistry | null,
): WorkflowSpecification {
  let next = spec;
  let fed = false;
  for (const binding of bindings) {
    const property = stepAcceptsSelector(registry, manifestType, binding.targetInput)
      ? binding.targetInput
      : stepAcceptsSelector(registry, manifestType, binding.sourceOutput)
        ? binding.sourceOutput
        : null;
    if (!property) {
      continue;
    }
    next = setParam(next, stepName, property, bindingSelector(binding));
    fed = true;
  }
  if (!fed) {
    return connectNodes(next, sourceId, stepNodeId(stepName), registry);
  }
  return next;
}

/**
 * Output the inserted block should publish into one severed binding.
 * Prefer the original output or field name, then a kind-compatible output,
 * then the block's first output so the downstream node stays connected.
 */
function insertedOutputFor(
  spec: WorkflowSpecification,
  outputs: OutputManifestEntry[],
  binding: DerivedEdge,
  registry?: BlockRegistry | null,
): OutputManifestEntry | undefined {
  const named =
    outputs.find((item) => item.name === binding.sourceOutput) ??
    outputs.find((item) => item.name === binding.targetInput);
  if (named) {
    return named;
  }
  const targetName = binding.target.startsWith("$steps.") ? binding.target.slice("$steps.".length) : null;
  const targetType = targetName
    ? stepsToList(spec.steps).find((entry) => entry.name === targetName)?.step.type
    : undefined;
  const accepted = targetType ? acceptedKindsForProperty(registry, targetType, binding.targetInput) : [];
  return outputs.find((output) => kindCompatible(accepted, output.kind[0]?.name ?? null)) ?? outputs[0];
}

/** Move every binding on the severed edge onto the inserted block. Nothing still points at the upstream node. */
function rebindPastInsert(
  spec: WorkflowSpecification,
  stepName: string,
  manifestType: string,
  bindings: DerivedEdge[],
  registry?: BlockRegistry | null,
): WorkflowSpecification {
  const outputs = blockOutputs(registry, manifestType);
  let next = spec;
  for (const binding of bindings) {
    const output = insertedOutputFor(next, outputs, binding, registry);
    if (!output) {
      next = disconnectEdge(next, {
        source: binding.source,
        target: binding.target,
        data: { sourceOutput: binding.sourceOutput, targetInput: binding.targetInput },
      });
      continue;
    }
    const selector = `$steps.${stepName}.${output.name}`;
    if (binding.target === OUTPUTS_NODE_ID) {
      next = setOutputSelector(next, binding.targetInput, selector);
    } else if (binding.target.startsWith("$steps.")) {
      next = setParam(next, binding.target.slice("$steps.".length), binding.targetInput, selector);
    }
  }
  return next;
}


export function setNodePosition(
  spec: WorkflowSpecification,
  nodeKey: string,
  x: number,
  y: number,
): WorkflowSpecification {
  return updateUi(spec, (ui) => ({
    ...ui,
    nodes: { ...ui.nodes, [nodeKey]: { x, y } },
  }));
}

/** Commit dragged positions (single undo entry); handles note: ids. */
export function applyNodePositions(
  spec: WorkflowSpecification,
  positions: Record<string, UiPosition>,
): WorkflowSpecification {
  let next = spec;
  for (const [nodeKey, position] of Object.entries(positions)) {
    if (nodeKey.startsWith("note:")) {
      next = updateNote(next, nodeKey.slice("note:".length), { x: position.x, y: position.y });
    } else {
      next = setNodePosition(next, nodeKey, position.x, position.y);
    }
  }
  return next;
}

/**
 * Add a workflow input. The inline form supplies the name; a colliding name is
 * made unique with a numeric suffix (defensive — the form validates first).
 * WorkflowParameter entries may carry a kind annotation and a default value.
 */
export function addInput(
  spec: WorkflowSpecification,
  name: string,
  type: string,
  kind?: string[],
  defaultValue?: unknown,
): WorkflowSpecification {
  const trimmed = name.trim();
  const names = new Set((spec.inputs ?? []).map((input) => input.name));
  let unique = trimmed;
  let counter = 2;
  while (names.has(unique)) {
    unique = `${trimmed}_${counter}`;
    counter += 1;
  }
  const entry: WorkflowInputSpec = { type, name: unique };
  if (kind) {
    entry.kind = kind;
  }
  if (defaultValue !== undefined) {
    entry.default_value = defaultValue;
  }
  return { ...spec, inputs: [...(spec.inputs ?? []), entry] };
}

/**
 * Remove a workflow input. References to `$inputs.<name>` are left dangling on
 * purpose: the validator flags them, matching the cloud builder's behavior.
 */
/** Move an input to another index. A no-op when the name or index is out of range. */
export function moveInput(spec: WorkflowSpecification, name: string, toIndex: number): WorkflowSpecification {
  const inputs = [...(spec.inputs ?? [])];
  const fromIndex = inputs.findIndex((input) => input.name === name);
  if (fromIndex < 0 || toIndex < 0 || toIndex >= inputs.length || fromIndex === toIndex) {
    return spec;
  }
  const [moved] = inputs.splice(fromIndex, 1);
  inputs.splice(toIndex, 0, moved);
  return { ...spec, inputs };
}

/**
 * Set or clear a parameter input's default. `undefined` drops both the value
 * and the kind annotation, matching the builder (kind is inferred from the value).
 */
export function setInputDefault(
  spec: WorkflowSpecification,
  name: string,
  defaultValue: unknown,
  kind?: string[],
): WorkflowSpecification {
  const inputs = (spec.inputs ?? []).map((input) => {
    if (input.name !== name) {
      return input;
    }
    const next: WorkflowInputSpec = { ...input };
    if (defaultValue === undefined) {
      delete next.default_value;
      delete next.kind;
      return next;
    }
    next.default_value = defaultValue;
    if (kind) {
      next.kind = kind;
    }
    return next;
  });
  return { ...spec, inputs };
}

/** Rename an input and, for parameters, set or clear its default in one step. */
export function editInput(
  spec: WorkflowSpecification,
  oldName: string,
  newName: string,
  defaultUpdate?: { value: unknown; kind?: string[] } | "clear",
): WorkflowSpecification {
  const trimmed = newName.trim();
  let next = spec;
  if (trimmed && trimmed !== oldName) {
    next = renameInput(next, oldName, trimmed);
  }
  if (defaultUpdate === undefined) {
    return next;
  }
  const target = trimmed || oldName;
  if (defaultUpdate === "clear") {
    return setInputDefault(next, target, undefined);
  }
  return setInputDefault(next, target, defaultUpdate.value, defaultUpdate.kind);
}

export function removeInput(spec: WorkflowSpecification, name: string): WorkflowSpecification {
  return { ...spec, inputs: (spec.inputs ?? []).filter((input) => input.name !== name) };
}

/** Rename a workflow input, rewriting `$inputs.<old>` references everywhere. */
export function renameInput(spec: WorkflowSpecification, oldName: string, newName: string): WorkflowSpecification {
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName) {
    return spec;
  }
  const names = new Set((spec.inputs ?? []).map((input) => input.name));
  if (names.has(trimmed)) {
    return spec;
  }
  const inputs = (spec.inputs ?? []).map((input) => (input.name === oldName ? { ...input, name: trimmed } : input));
  const steps = stepsToList(spec.steps).map(({ step }) => {
    const nextStep: WorkflowStepSpec = { ...step };
    for (const [property, value] of Object.entries(step)) {
      if (property === "type" || property === "name") {
        continue;
      }
      nextStep[property] = rewriteInputReferences(value, oldName, trimmed);
    }
    return nextStep;
  });
  const outputs = (spec.outputs ?? []).map((output) => ({
    ...output,
    selector: rewriteInputReferences(output.selector, oldName, trimmed) as string,
  }));
  return { ...spec, inputs, steps, outputs };
}

/** `{base}_output`, then `{base}_output_2`, `{base}_output_3`, matching the builder. */
export function nextOutputName(existing: Iterable<string>, base: string): string {
  const taken = new Set(existing);
  const root = `${base}_output`;
  if (!taken.has(root)) {
    return root;
  }
  let counter = 2;
  while (taken.has(`${root}_${counter}`)) {
    counter += 1;
  }
  return `${root}_${counter}`;
}

/** Step or input name a selector addresses, used as the output-name stem. */
export function outputBaseName(selector: string): string {
  const parsed = parseSelector(selector);
  if (parsed?.scope === "inputs" && parsed.inputName) {
    return parsed.inputName;
  }
  if (parsed?.scope === "steps" && parsed.stepName) {
    return parsed.stepName;
  }
  return "output";
}

/** Append a JsonField row. A blank or taken name falls back to `nextOutputName`. */
export function addBoundOutput(spec: WorkflowSpecification, name: string, selector: string): WorkflowSpecification {
  const boundSelector = canonicalOutputSelector(selector);
  const existing = (spec.outputs ?? []).map((output) => output.name);
  const trimmed = name.trim();
  const finalName = trimmed && !existing.includes(trimmed) ? trimmed : nextOutputName(existing, outputBaseName(boundSelector));
  return withOutputs(spec, [...(spec.outputs ?? []), { type: "JsonField", name: finalName, selector: boundSelector }]);
}

/** Rename a workflow output row (output names are not selector targets). */
export function renameOutput(spec: WorkflowSpecification, oldName: string, newName: string): WorkflowSpecification {
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName) {
    return spec;
  }
  const names = new Set((spec.outputs ?? []).map((output) => output.name));
  if (names.has(trimmed)) {
    return spec;
  }
  return {
    ...spec,
    outputs: (spec.outputs ?? []).map((output) => (output.name === oldName ? { ...output, name: trimmed } : output)),
  };
}

export function addOutput(spec: WorkflowSpecification): WorkflowSpecification {
  const name = uniqueName((spec.outputs ?? []).map((output) => output.name), "output");
  return withOutputs(spec, [...(spec.outputs ?? []), { type: "JsonField", name, selector: "" }]);
}

export function removeOutput(spec: WorkflowSpecification, name: string): WorkflowSpecification {
  return withOutputs(spec, (spec.outputs ?? []).filter((output) => output.name !== name));
}

export function setOutputSelector(spec: WorkflowSpecification, name: string, selector: string): WorkflowSpecification {
  const boundSelector = canonicalOutputSelector(selector);
  return withOutputs(
    spec,
    (spec.outputs ?? []).map((output) => (output.name === name ? { ...output, selector: boundSelector } : output)),
  );
}

export function addNote(spec: WorkflowSpecification, note: UiNote): WorkflowSpecification {
  return updateUi(spec, (ui) => ({ ...ui, notes: [...(ui.notes ?? []), { ...note }] }));
}

export function updateNote(spec: WorkflowSpecification, noteId: string, patch: Partial<UiNote>): WorkflowSpecification {
  return updateUi(spec, (ui) => ({
    ...ui,
    notes: (ui.notes ?? []).map((note) => (note.id === noteId ? { ...note, ...patch } : note)),
  }));
}

export function removeNote(spec: WorkflowSpecification, noteId: string): WorkflowSpecification {
  return updateUi(spec, (ui) => ({
    ...ui,
    notes: (ui.notes ?? []).filter((note) => note.id !== noteId),
  }));
}

export function toggleDisabled(spec: WorkflowSpecification, nodeKey: string): WorkflowSpecification {
  return updateUi(spec, (ui) => {
    const disabled = ui.disabled ?? [];
    const isEnabled = !disabled.includes(nodeKey);
    return {
      ...ui,
      disabled: isEnabled ? [...disabled, nodeKey] : disabled.filter((key) => key !== nodeKey),
    };
  });
}
