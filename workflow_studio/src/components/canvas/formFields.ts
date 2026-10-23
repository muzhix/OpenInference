/**
 * Expanded-form field visibility (cloud builder behavior).
 *
 * Primary (on the node): required fields, `always_visible` fields, selector
 * fields bound to a `$` reference, and `relevant_for` fields whose controller
 * matches and marks them required.
 * Additional (left-hand panel): every other relevant schema field. A literal
 * edit stays in the panel; only binding a selector moves that field onto the block.
 * Fields whose `relevant_for` controller does not match are omitted.
 * `operations_parameters` is omitted when `operations` is present — that
 * dictionary is written by the operations configure dialog.
 */

import type { JsonSchemaProperty } from "../../types/registry";

export interface SplitFormFieldsResult {
  /** Visible by default; required fields first, then others in schema order. */
  primary: string[];
  /** Hidden until the additional-properties panel is opened (schema order). */
  additional: string[];
}

interface RelevantRule {
  values?: unknown[];
  required?: boolean;
}

function isBoundSelector(value: unknown): boolean {
  return typeof value === "string" && value.startsWith("$");
}

function relevantRules(schema: JsonSchemaProperty | undefined): Record<string, RelevantRule> | null {
  const raw = schema?.relevant_for;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  return raw as Record<string, RelevantRule>;
}

/** Controller value, falling back to the schema default when the step leaves it unset. */
function controllerValue(
  key: string,
  values: Record<string, unknown>,
  properties: Record<string, JsonSchemaProperty>,
): unknown {
  const current = values[key];
  if (current !== undefined && current !== null && current !== "") {
    return current;
  }
  return properties[key]?.default;
}

/** False when a `relevant_for` rule exists and the controlling field is outside its values. */
export function isFieldRelevant(
  key: string,
  properties: Record<string, JsonSchemaProperty>,
  values: Record<string, unknown>,
): boolean {
  const rules = relevantRules(properties[key]);
  if (!rules) {
    return true;
  }
  for (const [controller, spec] of Object.entries(rules)) {
    const allowed = (spec?.values ?? []).map((value) => String(value));
    if (!allowed.includes(String(controllerValue(controller, values, properties)))) {
      return false;
    }
  }
  return true;
}

function isForcedPrimary(
  key: string,
  properties: Record<string, JsonSchemaProperty>,
  values: Record<string, unknown>,
): boolean {
  const rules = relevantRules(properties[key]);
  if (!rules || !isFieldRelevant(key, properties, values)) {
    return false;
  }
  return Object.values(rules).some((spec) => spec?.required === true);
}

/**
 * Split a block's form fields into default-visible (`primary`) and collapsed
 * (`additional`) keys. Keys come from the schema declaration order plus any
 * step parameters the schema does not declare (extra keys, appended in value
 * order).
 */
export function splitFormFields(
  properties: Record<string, JsonSchemaProperty>,
  required: string[],
  values: Record<string, unknown>,
  selectorFields: string[],
): SplitFormFieldsResult {
  const schemaKeys = Object.keys(properties).filter((key) => key !== "type" && key !== "name");
  const extraKeys = Object.keys(values).filter(
    (key) => key !== "type" && key !== "name" && !(key in properties),
  );
  let allKeys = [...schemaKeys, ...extraKeys];
  if (allKeys.includes("operations")) {
    allKeys = allKeys.filter((key) => key !== "operations_parameters");
  }

  const isPrimary = (key: string): boolean => {
    if (!isFieldRelevant(key, properties, values)) {
      return false;
    }
    if (required.includes(key) || properties[key]?.always_visible === true || isForcedPrimary(key, properties, values)) {
      return true;
    }
    if (selectorFields.includes(key) && isBoundSelector(values[key])) {
      return true;
    }
    // Edited schema fields stay in Additional Properties. Only params the
    // schema does not declare still surface on the node.
    return !(key in properties);
  };

  const primary = allKeys.filter(isPrimary);
  const primarySet = new Set(primary);
  const additional = allKeys.filter(
    (key) => !primarySet.has(key) && isFieldRelevant(key, properties, values),
  );

  const requiredSet = new Set(required);
  primary.sort((a, b) => Number(requiredSet.has(b)) - Number(requiredSet.has(a)));

  return { primary, additional };
}
