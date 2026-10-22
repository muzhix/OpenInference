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

  it("promotes an optional field whose value differs from the schema default", () => {
    const { primary, additional } = splitFormFields(
      SAM_LIKE_PROPERTIES,
      ["image"],
      { image: "$inputs.image", confidence: 0.9, visualization: false },
      ["image"],
    );
    expect(primary).toEqual(["image", "confidence"]);
    expect(additional).toEqual(["model_version", "visualization"]);
  });

  it("orders primary fields required first, then the remaining schema order", () => {
    const { primary } = splitFormFields(
      SAM_LIKE_PROPERTIES,
      ["confidence"],
      { image: "$inputs.image", confidence: 0.5, visualization: true },
      ["image"],
    );
    expect(primary).toEqual(["confidence", "image", "visualization"]);
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

  it("hides an optional field explicitly set to the schema default", () => {
    const { primary } = splitFormFields(
      SAM_LIKE_PROPERTIES,
      [],
      { model_version: "v3" },
      [],
    );
    expect(primary).toEqual([]);
  });
});
