/**
 * Workflow specification data model (04-node-system-and-graph-schema.md).
 *
 * The editor's `spec` state is the inner specification object: the object with
 * version/inputs/steps/outputs (plus optional metadata). The `specification`
 * wrapper key only appears in run payloads; `saveDraft` sends the inner object
 * directly as `config`.
 */

export interface WorkflowInputSpec {
  type: string;
  name: string;
}

export interface WorkflowOutputSpec {
  type: string;
  name: string;
  selector: string;
}

/** A workflow step. `type` + `name` are semantic keys; every other key is a parameter (which may hold selector strings). */
export interface WorkflowStepSpec {
  type: string;
  name?: string;
  [parameter: string]: unknown;
}

export interface UiPosition {
  x: number;
  y: number;
}

/** UI projection of a semantic (selector-derived) edge, persisted in metadata.ui.edges. */
export interface UiEdgeProjection {
  source: string;
  target: string;
  inputProperty?: string;
  sourceSelector?: string;
}

export interface UiNote {
  id: string;
  x: number;
  y: number;
  text: string;
}

export interface WorkflowSpecUi {
  nodes?: Record<string, UiPosition>;
  edges?: UiEdgeProjection[];
  groups?: unknown[];
  notes?: UiNote[];
  /** Node keys ("$inputs" | "$steps.<name>" | "$outputs") whose steps are disabled in the UI. */
  disabled?: string[];
}

export interface WorkflowMetadata {
  ui?: WorkflowSpecUi;
}

export interface WorkflowSpecification {
  version: string;
  inputs: WorkflowInputSpec[];
  steps: WorkflowStepSpec[] | Record<string, WorkflowStepSpec>;
  outputs: WorkflowOutputSpec[];
  metadata?: WorkflowMetadata;
}

/** Legacy input type name kept compatible with WorkflowImage (04 §1). */
export function isImageInputType(type: string): boolean {
  return type === "WorkflowImage" || type === "InferenceImage";
}

/** Normalize steps (engine/cloud arrays or engine-internal record) to named entries. */
export interface NamedStep {
  name: string;
  step: WorkflowStepSpec;
}

export function stepsToList(
  steps: WorkflowSpecification["steps"],
): NamedStep[] {
  if (Array.isArray(steps)) {
    return steps.map((step, index) => ({
      name: typeof step.name === "string" && step.name ? step.name : `step_${index}`,
      step,
    }));
  }
  if (steps && typeof steps === "object") {
    return Object.entries(steps).map(([name, step]) => ({ name, step }));
  }
  return [];
}
