import { describe, expect, it } from "vitest";

import { splitFormFields } from "./formFields";

import type { JsonSchemaProperty } from "../../types/registry";

/** SAM3-like schema: one required image selector plus optional tuning fields. */
const SAM_LIKE_PROPERTIES: Record<string, JsonSchemaProperty> = {
  image: { type: "string", title: "Image", description: "Image to process" },
  model_version: { type: "string", title: "Model Version", default: "v3" },
  confidence: { type: "number", title: "Confidence", default: 0.5 },
  visualization: { type: "boolean", title: "Visualize", default: false },
};

describe("splitFormFields (cloud visibility rules)", () => {
  it("shows only required fields when every optional value matches its default", () => {
    const { primary, additional } = splitFormFields(SAM_LIKE_PROPERTIES, ["image"], { image: "$inputs.image" }, ["image"]);
    expect(primary).toEqual(["image"]);
    expect(additional).toEqual(["model_version", "confidence", "visualization"]);
  });

  it("shows a selector field only when it currently holds a value", () => {
    const { primary, additional } = splitFormFields(SAM_LIKE_PROPERTIES, ["image"], { image: "" }, ["image"]);
    // Required fields stay visible even when unset.
    expect(primary).toEqual(["image"]);
    expect(additional).toEqual(["model_version", "confidence", "visualization"]);

    const optionalSelectorProperties: Record<string, JsonSchemaProperty> = {
      ...SAM_LIKE_PROPERTIES,
      mask: { type: "string", title: "Mask" },
    };
    const unset = splitFormFields(optionalSelectorProperties, ["image"], { image: "$inputs.image" }, ["image", "mask"]);
    expect(unset.primary).toEqual(["image"]);
    expect(unset.additional).toContain("mask");

    const set = splitFormFields(optionalSelectorProperties, ["image"], { image: "$inputs.image", mask: "$steps.a.image" }, ["image", "mask"]);
    expect(set.primary).toEqual(["image", "mask"]);
  });

  it("keeps a literal edit of a selector-capable field in the additional panel", () => {
    const properties: Record<string, JsonSchemaProperty> = {
      ...SAM_LIKE_PROPERTIES,
      iou_threshold: { type: "number", title: "Iou Threshold", default: 0.3 },
    };
    const { primary, additional } = splitFormFields(
      properties,
      ["image"],
      { image: "$inputs.image", iou_threshold: 0.4 },
      ["image", "iou_threshold"],
    );
    expect(primary).toEqual(["image"]);
    expect(additional).toContain("iou_threshold");
  });

  it("keeps an edited optional field in the additional panel", () => {
    const { primary, additional } = splitFormFields(
      SAM_LIKE_PROPERTIES,
      ["image"],
      { image: "$inputs.image", confidence: 0.9, visualization: true },
      ["image"],
    );
    expect(primary).toEqual(["image"]);
    expect(additional).toEqual(["model_version", "confidence", "visualization"]);
  });

  it("orders primary fields required first, then the remaining schema order", () => {
    const properties: Record<string, JsonSchemaProperty> = {
      ...SAM_LIKE_PROPERTIES,
      mask: { type: "string", title: "Mask" },
    };
    const { primary } = splitFormFields(
      properties,
      ["confidence"],
      { image: "$inputs.image", confidence: 0.5, mask: "$steps.a.image" },
      ["image", "mask"],
    );
    expect(primary).toEqual(["confidence", "image", "mask"]);
  });

  it("keeps undeclared step params as visible fields appended after schema keys", () => {
    const { primary, additional } = splitFormFields(
      SAM_LIKE_PROPERTIES,
      ["image"],
      { image: "$inputs.image", custom_param: "keep me" },
      ["image"],
    );
    expect(primary).toEqual(["image", "custom_param"]);
    expect(additional).toEqual(["model_version", "confidence", "visualization"]);
  });

  it("keeps always_visible fields on the node even when they still hold the default", () => {
    const properties: Record<string, JsonSchemaProperty> = {
      ...SAM_LIKE_PROPERTIES,
      confidence_mode: { type: "string", title: "Confidence Mode", default: "best", always_visible: true },
    };
    const { primary, additional } = splitFormFields(properties, ["image"], { image: "$inputs.image" }, ["image"]);
    expect(primary).toEqual(["image", "confidence_mode"]);
    expect(additional).not.toContain("confidence_mode");
  });

  it("hides a relevant_for field until its controller matches, then promotes it when required", () => {
    const properties: Record<string, JsonSchemaProperty> = {
      ...SAM_LIKE_PROPERTIES,
      confidence_mode: { type: "string", default: "best", always_visible: true },
      custom_confidence: {
        type: "number",
        default: 0.4,
        relevant_for: { confidence_mode: { values: ["custom"], required: true } },
      },
    };
    const hidden = splitFormFields(properties, ["image"], { image: "$inputs.image" }, ["image"]);
    expect(hidden.primary).not.toContain("custom_confidence");
    expect(hidden.additional).not.toContain("custom_confidence");

    const shown = splitFormFields(
      properties,
      ["image"],
      { image: "$inputs.image", confidence_mode: "custom" },
      ["image"],
    );
    expect(shown.primary).toEqual(["image", "confidence_mode", "custom_confidence"]);
  });

  it("drops operations_parameters when the operations dialog owns that dictionary", () => {
    const properties: Record<string, JsonSchemaProperty> = {
      predictions: { type: "string", title: "Predictions" },
      operations: { type: "array", title: "Operations" },
      operations_parameters: { type: "object", default: {} },
    };
    const { primary, additional } = splitFormFields(properties, ["predictions", "operations"], {}, ["predictions"]);
    expect(primary).toEqual(["predictions", "operations"]);
    expect(additional).toEqual([]);
  });

  it("leaves an optional field in the additional panel when it is set back to the schema default", () => {
    const { primary, additional } = splitFormFields(
      SAM_LIKE_PROPERTIES,
      [],
      { model_version: "v3" },
      [],
    );
    expect(primary).toEqual([]);
    expect(additional).toContain("model_version");
  });
});
