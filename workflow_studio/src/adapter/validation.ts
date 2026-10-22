/** Local (instant) spec validation: dangling references + duplicate step names. */

import { collectSelectorStrings, parseSelector } from "./selectors";

import type { BlockRegistry } from "../types/registry";
import type { WorkflowSpecification } from "../types/spec";
import { stepsToList } from "../types/spec";

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface LocalValidation {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface DanglingReference {
  selector: string;
  /** Node key of the consumer: "$steps.<name>" | "$outputs". */
  consumer: string;
  /** Dot path into the spec for status display. */
  path: string;
  reason: "missing_step" | "missing_input";
}

export function findDanglingReferences(spec: WorkflowSpecification): DanglingReference[] {
  const stepNames = new Set(stepsToList(spec.steps).map((entry) => entry.name));
  const inputNames = new Set((spec.inputs ?? []).map((input) => input.name));
  const dangling: DanglingReference[] = [];

  const check = (value: unknown, consumer: string, path: string): void => {
    for (const selectorString of collectSelectorStrings(value)) {
      const parsed = parseSelector(selectorString);
      if (!parsed) {
        continue;
      }
      if (parsed.scope === "inputs" && !inputNames.has(parsed.inputName ?? "")) {
        dangling.push({ selector: selectorString, consumer, path, reason: "missing_input" });
      } else if (parsed.scope === "steps" && !stepNames.has(parsed.stepName ?? "")) {
        dangling.push({ selector: selectorString, consumer, path, reason: "missing_step" });
      }
    }
  };

  for (const { name, step } of stepsToList(spec.steps)) {
    for (const [property, value] of Object.entries(step)) {
      if (property === "type" || property === "name") {
        continue;
      }
      check(value, `$steps.${name}`, `steps.${name}.${property}`);
    }
  }
  for (const output of spec.outputs ?? []) {
    check(output.selector, "$outputs", `outputs.${output.name}.selector`);
  }
  return dangling;
}

/** Quick local check for instant feedback; the server validator is authoritative. */
export function localValidate(spec: WorkflowSpecification, registry?: BlockRegistry | null): LocalValidation {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  for (const ref of findDanglingReferences(spec)) {
    errors.push({
      code: "dangling_reference",
      path: ref.path,
      message: `Dangling reference "${ref.selector}" (${ref.reason === "missing_step" ? "unknown step" : "unknown input"})`,
    });
  }

  const seen = new Set<string>();
  for (const { name } of stepsToList(spec.steps)) {
    if (seen.has(name)) {
      errors.push({
        code: "duplicate_step_name",
        path: `steps.${name}`,
        message: `Duplicate step name "${name}"`,
      });
    }
    seen.add(name);
  }

  if (registry) {
    const stepNames = new Set(stepsToList(spec.steps).map((entry) => entry.name));
    for (const { name, step } of stepsToList(spec.steps)) {
      const block = registry.blocks.find((item) => item.manifest_type_identifier === step.type);
      const declaredOutputs = block?.outputs_manifest ?? [];
      if (declaredOutputs.length === 0) {
        continue;
      }
      for (const [property, value] of Object.entries(step)) {
        if (property === "type" || property === "name") {
          continue;
        }
        for (const selectorString of collectSelectorStrings(value)) {
          const parsed = parseSelector(selectorString);
          const referencedStep = parsed?.stepName ?? "";
          if (parsed?.scope !== "steps" || !stepNames.has(referencedStep) || !parsed.outputName) {
            continue;
          }
          if (referencedStep === name) {
            continue;
          }
          const referenced = stepsToList(spec.steps).find((entry) => entry.name === referencedStep);
          const referencedBlock = referenced
            ? registry.blocks.find((item) => item.manifest_type_identifier === referenced.step.type)
            : null;
          const referencedOutputs = referencedBlock?.outputs_manifest ?? [];
          if (referencedOutputs.length > 0 && !knownReferenceOutput(referencedOutputs.map((o) => o.name), parsed.outputName)) {
            warnings.push({
              code: "unknown_output",
              path: `steps.${name}.${property}`,
              message: `"${selectorString}" references output "${parsed.outputName}" which "${referencedStep}" may not declare`,
            });
          }
        }
      }
    }
  }

  return { errors, warnings };
}

function knownReferenceOutput(names: string[], outputName: string): boolean {
  return names.includes(outputName) || outputName.startsWith("all_properties");
}

/**
 * Best-effort mapping of a validation issue path onto the canvas node key it
 * concerns (`"$steps.<name>"` | `"$outputs"`), for the immediate red-dot
 * feedback on node cards. Returns null for paths with no single node target.
 */
export function nodeKeyForValidationPath(path: string): string | null {
  if (!path) {
    return null;
  }
  const stepMatch = /^steps\.([A-Za-z0-9_]+)(?:\.|$)/.exec(path);
  if (stepMatch) {
    return `$steps.${stepMatch[1]}`;
  }
  if (/^outputs(\[|\.|$)/.test(path)) {
    return "$outputs";
  }
  if (/^inputs(\[|\.|$)/.test(path)) {
    return "$inputs";
  }
  return null;
}

/** Validation error messages whose path maps to the given node key (03 §5 feedback). */
export function errorsForNodeKey(
  issues: readonly ValidationIssue[],
  nodeKey: string,
): string[] {
  return issues
    .filter((issue) => nodeKeyForValidationPath(issue.path) === nodeKey)
    .map((issue) => (issue.path ? `${issue.path}: ${issue.message}` : issue.message));
}
