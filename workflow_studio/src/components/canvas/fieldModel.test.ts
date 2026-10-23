import { describe, expect, it } from "vitest";

import {
  enumLabel,
  enumValues,
  formatStringList,
  isStringListSchema,
  listPlaceholder,
  nudgeNumber,
  parseStringList,
  poweredByOf,
  selectorChipLabel,
  selectorSourceStep,
} from "./fieldModel";

import type { JsonSchemaProperty } from "../../types/registry";

const CONFIDENCE_MODE: JsonSchemaProperty = {
  default: "best",
  always_visible: true,
  anyOf: [{ type: "string", enum: ["best", "default", "custom"] }, { type: "string" }],
  values_metadata: {
    best: { name: "Best (Recommended)" },
    default: { name: "Default" },
    custom: { name: "Custom" },
  },
};

describe("fieldModel", () => {
  it("reads enum members from a union branch and labels them from values_metadata", () => {
    expect(enumValues(CONFIDENCE_MODE)).toEqual(["best", "default", "custom"]);
    expect(enumLabel("best", CONFIDENCE_MODE)).toBe("Best (Recommended)");
    expect(enumLabel("other", CONFIDENCE_MODE)).toBe("other");
  });

  it("uses the first array example as a string-list placeholder", () => {
    const schema: JsonSchemaProperty = {
      type: "array",
      items: { type: "string" },
      examples: [["a", "b", "c"], "$inputs.class_filter"],
    };
    expect(isStringListSchema(schema)).toBe(true);
    expect(listPlaceholder(schema)).toBe("a, b, c");
    expect(formatStringList(["person", "car"])).toBe("person, car");
    expect(parseStringList(" person, car , ")).toEqual(["person", "car"]);
    expect(parseStringList("  ")).toBeUndefined();
  });

  it("shortens selector chips to the builder's inputs./step.output label", () => {
    expect(selectorChipLabel("$inputs.image")).toBe("inputs.image");
    expect(selectorChipLabel("$steps.model.predictions")).toBe("model.predictions");
    expect(selectorSourceStep("$steps.model.predictions")).toBe("model");
    expect(selectorSourceStep("$inputs.image")).toBeNull();
  });

  it("steps an empty number field from its schema default", () => {
    const iou = { type: "number", default: 0.3 };
    const maxDetections = { type: "integer", default: 300 };
    expect(nudgeNumber("", iou, 1)).toBe(0.4);
    expect(nudgeNumber("", iou, -1)).toBe(0.2);
    expect(nudgeNumber("", maxDetections, 1)).toBe(301);
    expect(nudgeNumber("0.5", iou, 1)).toBe(0.6);
    expect(nudgeNumber("", { type: "number", default: 0.25, multipleOf: 0.05 }, 1)).toBe(0.3);
  });

  it("picks the powered-by credit from ui_manifest flags", () => {
    expect(poweredByOf({ supervision: true })?.label).toBe("Supervision");
    expect(poweredByOf({ inference: true })?.label).toBe("Inference");
    expect(poweredByOf({})).toBeNull();
  });
});
