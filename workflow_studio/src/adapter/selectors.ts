/**
 * Selector utilities. Selectors are the workflow graph's addressing scheme:
 * `$inputs.<name>` / `$steps.<name>.<output>` (optionally with UQL suffixes
 * such as `[i]` or `[:1]`). A reference is an edge (04 §1).
 */

export interface ParsedSelector {
  scope: "inputs" | "steps";
  /** Referenced input name (scope=inputs). */
  inputName?: string;
  /** Referenced step name (scope=steps). */
  stepName?: string;
  /** Referenced step output name; selectors may address deeper paths/UQL. */
  outputName?: string;
  /** Node id of the referenced source ("$inputs" | "$steps.<name>"). */
  sourceNodeId: string;
}

const SELECTOR_PREFIX_RE = /^\$(inputs|steps)\.([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?/;

/** Validate selector syntax (prefix match allows UQL suffixes like `[:1]`). */
export function isValidSelectorSyntax(value: string): boolean {
  return SELECTOR_PREFIX_RE.test(value);
}

export function parseSelector(value: string): ParsedSelector | null {
  const match = SELECTOR_PREFIX_RE.exec(value.trim());
  if (!match) {
    return null;
  }
  const name = match[2] ?? "";
  const output = match[3];
  if (match[1] === "inputs") {
    return { scope: "inputs", inputName: name, sourceNodeId: "$inputs" };
  }
  return { scope: "steps", stepName: name, outputName: output, sourceNodeId: `$steps.${name}` };
}

/** Collect strings that look like selectors from any param value (incl. arrays/dicts). */
export function collectSelectorStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    if (value.startsWith("$") && isValidSelectorSyntax(value)) {
      out.push(value);
    }
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectSelectorStrings(item, out);
    }
    return out;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectSelectorStrings(item, out);
    }
  }
  return out;
}

/** Rewrite `$steps.<oldName>.` references inside an arbitrary param value. */
export function rewriteStepReferences(value: unknown, oldName: string, newName: string): unknown {
  if (typeof value === "string") {
    const oldPrefix = `$steps.${oldName}.`;
    if (value.startsWith(oldPrefix)) {
      return `$steps.${newName}.` + value.slice(oldPrefix.length);
    }
    if (value === `$steps.${oldName}`) {
      return `$steps.${newName}`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteStepReferences(item, oldName, newName));
  }
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      next[key] = rewriteStepReferences(item, oldName, newName);
    }
    return next;
  }
  return value;
}
