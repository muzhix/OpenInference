/**
 * Pure display helpers for schema-driven block fields: enum labels from
 * `values_metadata`, list placeholders from examples, selector chip text, and
 * the "Powered by" footer derived from `ui_manifest`.
 */

import type { JsonSchemaProperty } from "../../types/registry";

export interface PoweredBy {
  label: string;
  href: string;
}

interface SchemaBranch {
  type?: string | string[];
  enum?: unknown[];
  items?: JsonSchemaProperty["items"];
  anyOf?: unknown[];
  oneOf?: unknown[];
}

function branches(schema: JsonSchemaProperty | undefined): SchemaBranch[] {
  if (!schema) {
    return [];
  }
  const collected: unknown[] = [];
  for (const key of ["anyOf", "oneOf"] as const) {
    const value = schema[key];
    if (Array.isArray(value)) {
      collected.push(...value);
    }
  }
  return collected.filter((item): item is SchemaBranch => !!item && typeof item === "object");
}

function typeIncludes(schema: SchemaBranch, type: string): boolean {
  if (schema.type === type) {
    return true;
  }
  return Array.isArray(schema.type) && schema.type.includes(type);
}

/** Enum members declared directly or on a union branch (Literal + Selector). */
export function enumValues(schema: JsonSchemaProperty | undefined): string[] | null {
  if (!schema) {
    return null;
  }
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum.map((value) => String(value));
  }
  for (const branch of branches(schema)) {
    if (Array.isArray(branch.enum) && branch.enum.length > 0) {
      return branch.enum.map((value) => String(value));
    }
  }
  return null;
}

function schemaMatches(schema: JsonSchemaProperty | undefined, type: string): boolean {
  if (!schema) {
    return false;
  }
  if (typeIncludes(schema, type)) {
    return true;
  }
  return branches(schema).some((branch) => typeIncludes(branch, type));
}

export function isBooleanSchema(schema: JsonSchemaProperty | undefined): boolean {
  return schemaMatches(schema, "boolean") && enumValues(schema) === null;
}

export function isNumberSchema(schema: JsonSchemaProperty | undefined): boolean {
  return (schemaMatches(schema, "number") || schemaMatches(schema, "integer")) && enumValues(schema) === null;
}

function arrayItems(schema: JsonSchemaProperty | undefined): JsonSchemaProperty["items"] | null {
  if (!schema) {
    return null;
  }
  if ((schema.type === "array" || (Array.isArray(schema.type) && schema.type.includes("array"))) && schema.items) {
    return schema.items;
  }
  for (const branch of branches(schema)) {
    if (typeIncludes(branch, "array") && branch.items) {
      return branch.items;
    }
  }
  return null;
}

/** Comma-separated string lists (class filter, custom colors), not object arrays. */
export function isStringListSchema(schema: JsonSchemaProperty | undefined): boolean {
  const items = arrayItems(schema);
  if (!items) {
    return false;
  }
  if (items.type === "string") {
    return true;
  }
  return Array.isArray(items.type) && items.type.includes("string") && !items.type.includes("object");
}

/** Friendly enum label. Falls back to the raw value when metadata has no name. */
export function enumLabel(value: string, schema: JsonSchemaProperty | undefined): string {
  const meta = schema?.values_metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const entry = (meta as Record<string, { name?: string }>)[value];
    if (typeof entry?.name === "string" && entry.name.length > 0) {
      return entry.name;
    }
  }
  return value;
}

/** Placeholder for an empty string-list field, taken from the first array example. */
export function listPlaceholder(schema: JsonSchemaProperty | undefined): string {
  const examples = schema?.examples;
  if (!Array.isArray(examples)) {
    return "";
  }
  for (const example of examples) {
    if (Array.isArray(example) && example.every((item) => typeof item === "string" || typeof item === "number")) {
      return example.map((item) => String(item)).join(", ");
    }
  }
  return "";
}

export function formatStringList(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(", ");
  }
  return "";
}

export function parseStringList(text: string): string[] | undefined {
  const items = text
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return items.length > 0 ? items : undefined;
}

/** "$inputs.image" -> "inputs.image"; "$steps.model.predictions" -> "model.predictions". */
export function selectorChipLabel(selector: string): string {
  if (selector.startsWith("$inputs.")) {
    return `inputs.${selector.slice("$inputs.".length)}`;
  }
  if (selector.startsWith("$steps.")) {
    return selector.slice("$steps.".length);
  }
  return selector.replace(/^\$/, "");
}

/** Step name referenced by a `$steps` selector, if any. */
export function selectorSourceStep(selector: string): string | null {
  if (!selector.startsWith("$steps.")) {
    return null;
  }
  const rest = selector.slice("$steps.".length);
  const dot = rest.indexOf(".");
  return dot === -1 ? rest : rest.slice(0, dot);
}

/**
 * Footer credit from ui_manifest flags. Visualization blocks set `supervision`,
 * model blocks set `inference`. Blocks with neither flag have no footer.
 */
export function poweredByOf(ui: Record<string, unknown> | undefined): PoweredBy | null {
  if (ui?.supervision === true) {
    return { label: "Supervision", href: "https://github.com/roboflow/supervision" };
  }
  if (ui?.inference === true) {
    return { label: "Inference", href: "https://github.com/roboflow/inference" };
  }
  return null;
}

/** Value shown in a control when the step has not overridden the schema default. */
export function displayValue(value: unknown, schema: JsonSchemaProperty | undefined): unknown {
  if (value === undefined || value === null || value === "") {
    return schema?.default;
  }
  return value;
}

function declaredNumberStep(schema: JsonSchemaProperty | undefined): number | undefined {
  const multipleOf = schema?.multipleOf;
  return typeof multipleOf === "number" && multipleOf > 0 && Number.isFinite(multipleOf) ? multipleOf : undefined;
}

/** Step for the number spinner: schema `multipleOf`, otherwise one unit at the value's decimal scale. */
function numberStep(schema: JsonSchemaProperty | undefined, base: number): number {
  const declared = declaredNumberStep(schema);
  if (declared !== undefined) {
    return declared;
  }
  if (!Number.isFinite(base) || Number.isInteger(base)) {
    return 1;
  }
  const fraction = String(base).split(".")[1] ?? "";
  const places = Math.min(fraction.length, 6);
  return places > 0 ? 10 ** -places : 1;
}

/**
 * Next number for the up/down buttons.
 * An empty field starts from the schema default, so the gray hint is what gets stepped.
 */
export function nudgeNumber(current: string, schema: JsonSchemaProperty | undefined, direction: 1 | -1): number {
  const fallback = typeof schema?.default === "number" && Number.isFinite(schema.default) ? schema.default : 0;
  const parsed = Number(current);
  const base = current.trim() === "" || !Number.isFinite(parsed) ? fallback : parsed;
  const step = numberStep(schema, base);
  const places = Math.min((String(step).split(".")[1] ?? "").length, 8);
  return Number((base + direction * step).toFixed(places));
}
