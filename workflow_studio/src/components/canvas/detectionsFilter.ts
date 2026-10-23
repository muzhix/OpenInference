/**
 * Class & confidence rules for the Detections Filter "Configure" dialog.
 * Encodes the query-language `DetectionsFilter` operation the block expects.
 *
 * ponytail: Exclude round-trips via `ui_class_mode` (pydantic ignores unknown
 * keys) but the class statement is still `in (Sequence)` — the query language
 * has no not-in comparator, so an exclude rule keeps those classes at run time.
 * Upgrade path: emit a negation and drop `ui_class_mode`.
 */

export type ClassMode = "include" | "exclude";
export type ConfidenceOp = ">=" | ">" | "<=" | "<" | "==";

export interface DetectionsFilterDraft {
  classEnabled: boolean;
  classMode: ClassMode;
  classesText: string;
  confidenceEnabled: boolean;
  confidenceOp: ConfidenceOp;
  confidenceText: string;
}

export const EMPTY_FILTER_DRAFT: DetectionsFilterDraft = {
  classEnabled: false,
  classMode: "include",
  classesText: "",
  confidenceEnabled: false,
  confidenceOp: ">=",
  confidenceText: "0.5",
};

const CONFIDENCE_COMPARATOR: Record<ConfidenceOp, string> = {
  ">=": "(Number) >=",
  ">": "(Number) >",
  "<=": "(Number) <=",
  "<": "(Number) <",
  "==": "(Number) ==",
};

function confidenceOpFromComparator(type: unknown): ConfidenceOp {
  const found = (Object.entries(CONFIDENCE_COMPARATOR) as [ConfidenceOp, string][]).find(([, value]) => value === type);
  return found?.[0] ?? ">=";
}

function classesFromText(text: string): string[] {
  return text
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

interface Statement {
  type?: string;
  left_operand?: {
    type?: string;
    operand_name?: string;
    operations?: { type?: string; property_name?: string }[];
  };
  comparator?: { type?: string };
  right_operand?: { type?: string; value?: unknown };
}

function statementsOf(operations: unknown): { statements: Statement[]; classMode: ClassMode } {
  if (!Array.isArray(operations) || operations.length === 0) {
    return { statements: [], classMode: "include" };
  }
  const first = operations[0] as { filter_operation?: { statements?: Statement[] }; ui_class_mode?: string };
  const classMode = first?.ui_class_mode === "exclude" ? "exclude" : "include";
  const statements = first?.filter_operation?.statements;
  return { statements: Array.isArray(statements) ? statements : [], classMode };
}

function propertyName(statement: Statement): string | null {
  const operations = statement.left_operand?.operations;
  if (!Array.isArray(operations)) {
    return null;
  }
  const extract = operations.find((operation) => operation?.type === "ExtractDetectionProperty");
  return typeof extract?.property_name === "string" ? extract.property_name : null;
}

export function isFilterConfigured(operations: unknown): boolean {
  return statementsOf(operations).statements.length > 0;
}

export function draftFromOperations(operations: unknown): DetectionsFilterDraft {
  const { statements, classMode } = statementsOf(operations);
  const draft: DetectionsFilterDraft = { ...EMPTY_FILTER_DRAFT, classMode };
  for (const statement of statements) {
    const property = propertyName(statement);
    if (property === "class_name" && Array.isArray(statement.right_operand?.value)) {
      draft.classEnabled = true;
      draft.classesText = statement.right_operand.value.map((item) => String(item)).join(", ");
    }
    if (property === "confidence" && typeof statement.right_operand?.value === "number") {
      draft.confidenceEnabled = true;
      draft.confidenceOp = confidenceOpFromComparator(statement.comparator?.type);
      draft.confidenceText = String(statement.right_operand.value);
    }
  }
  return draft;
}

function propertyStatement(property: string, comparator: string, value: unknown): Statement {
  return {
    type: "BinaryStatement",
    left_operand: {
      type: "DynamicOperand",
      operand_name: "_",
      operations: [{ type: "ExtractDetectionProperty", property_name: property }],
    },
    comparator: { type: comparator },
    right_operand: { type: "StaticOperand", value },
  };
}

/** Build the `operations` array. Returns [] when neither rule is active. */
export function operationsFromDraft(draft: DetectionsFilterDraft): unknown[] {
  const statements: Statement[] = [];
  if (draft.classEnabled) {
    const classes = classesFromText(draft.classesText);
    if (classes.length > 0) {
      statements.push(propertyStatement("class_name", "in (Sequence)", classes));
    }
  }
  if (draft.confidenceEnabled) {
    const confidence = Number(draft.confidenceText);
    if (!Number.isNaN(confidence)) {
      statements.push(propertyStatement("confidence", CONFIDENCE_COMPARATOR[draft.confidenceOp], confidence));
    }
  }
  if (statements.length === 0) {
    return [];
  }
  return [
    {
      type: "DetectionsFilter",
      ui_class_mode: draft.classMode,
      filter_operation: {
        type: "StatementGroup",
        operator: statements.length > 1 ? "and" : "or",
        statements,
      },
    },
  ];
}

export function filterStatusLabel(operations: unknown): string {
  if (!isFilterConfigured(operations)) {
    return "Not configured";
  }
  const draft = draftFromOperations(operations);
  const parts: string[] = [];
  if (draft.classEnabled && draft.classesText.trim()) {
    parts.push(draft.classMode === "exclude" ? "Class excluded" : "Class");
  }
  if (draft.confidenceEnabled) {
    parts.push(`Confidence ${draft.confidenceOp} ${draft.confidenceText}`);
  }
  return parts.join(" · ") || "Configured";
}
