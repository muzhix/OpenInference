import { describe, expect, it } from "vitest";

import { draftFromOperations, filterStatusLabel, isFilterConfigured, operationsFromDraft } from "./detectionsFilter";

describe("detectionsFilter", () => {
  it("builds a class-and-confidence DetectionsFilter and reads it back", () => {
    const operations = operationsFromDraft({
      classEnabled: true,
      classMode: "include",
      classesText: "person, car",
      confidenceEnabled: true,
      confidenceOp: ">=",
      confidenceText: "0.5",
    });
    expect(isFilterConfigured(operations)).toBe(true);
    const operation = operations[0] as {
      type: string;
      filter_operation: { operator: string; statements: { comparator: { type: string } }[] };
    };
    expect(operation.type).toBe("DetectionsFilter");
    expect(operation.filter_operation.operator).toBe("and");
    expect(operation.filter_operation.statements).toHaveLength(2);
    expect(operation.filter_operation.statements[1]?.comparator.type).toBe("(Number) >=");

    const draft = draftFromOperations(operations);
    expect(draft.classEnabled).toBe(true);
    expect(draft.classesText).toBe("person, car");
    expect(draft.confidenceEnabled).toBe(true);
    expect(draft.confidenceOp).toBe(">=");
    expect(draft.confidenceText).toBe("0.5");
    expect(filterStatusLabel(operations)).toBe("Class · Confidence >= 0.5");
  });

  it("treats an empty draft as not configured", () => {
    expect(operationsFromDraft({
      classEnabled: false,
      classMode: "include",
      classesText: "",
      confidenceEnabled: false,
      confidenceOp: ">=",
      confidenceText: "0.5",
    })).toEqual([]);
    expect(filterStatusLabel(undefined)).toBe("Not configured");
  });
});
