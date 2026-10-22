/**
 * Expanded-form field visibility (cloud builder behavior): by default a form
 * shows ONLY required fields, fields whose current value differs from the
 * schema default, and selector-typed fields that currently hold a value.
 * Everything else hides behind the "Show Additional Properties" toggle.
 */

import type { JsonSchemaProperty } from "../../types/registry";

export interface SplitFormFieldsResult {
  /** Visible by default; required fields first, then others in schema order. */
  primary: string[];
  /** Hidden until the additional-properties toggle is opened (schema order). */
  additional: string[];
}

/** True when the field will run with its schema default: unset, or explicitly equal to the default. */
function isDefaulted(value: unknown, schemaDefault: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  return JSON.stringify(value ?? null) === JSON.stringify(schemaDefault ?? null);
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

/**
 * Split a block's form fields into default-visible (`primary`) and collapsed
 * (`additional`) keys. Keys come from the schema declaration order plus any
 * step parameters the schema does not declare (extra keys, appended in value
 * order). A field is default-visible when it is required, or selector-typed
 * with a current value, or its value differs from what the schema default
 * would produce.
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
  const allKeys = [...schemaKeys, ...extraKeys];

  const isPrimary = (key: string): boolean => {
    if (required.includes(key)) {
      return true;
    }
    if (selectorFields.includes(key) && hasValue(values[key])) {
      return true;
    }
    return !isDefaulted(values[key], properties[key]?.default);
  };

  const primary = allKeys.filter(isPrimary);
  const primarySet = new Set(primary);
  const additional = allKeys.filter((key) => !primarySet.has(key));

  const requiredSet = new Set(required);
  primary.sort((a, b) => Number(requiredSet.has(b)) - Number(requiredSet.has(a)));

  return { primary, additional };
}
