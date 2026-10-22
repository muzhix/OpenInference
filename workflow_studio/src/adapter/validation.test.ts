import { describe, expect, it } from "vitest";

import { errorsForNodeKey, findDanglingReferences, nodeKeyForValidationPath } from "./validation";

import type { WorkflowSpecification } from "../types/spec";

const spec = (overrides: Partial<WorkflowSpecification> = {}): WorkflowSpecification => ({
  version: "1.0",
  inputs: [{ type: "WorkflowImage", name: "image" }],
  steps: [
    {
      type: "roboflow_core/contrast_enhancement@v1",
      name: "contrast_enhancement",
      image: "$inputs.image",
    },
  ],
  outputs: [
    {
      type: "JsonField",
      name: "output_image",
      selector: "$steps.contrast_enhancement.image",
    },
  ],
  ...overrides,
});

describe("findDanglingReferences", () => {
  it("reports nothing for a healthy spec", () => {
    expect(findDanglingReferences(spec())).toEqual([]);
  });

  it("reports outputs referencing a removed step at the outputs node", () => {
    const dangling = findDanglingReferences(
      spec({
        steps: [],
        outputs: [
          { type: "JsonField", name: "output_image", selector: "$steps.contrast_enhancement.image" },
        ],
      }),
    );
    expect(dangling).toHaveLength(1);
    expect(dangling[0]).toMatchObject({
      consumer: "$outputs",
      path: "outputs.output_image.selector",
      reason: "missing_step",
    });
  });
});

describe("nodeKeyForValidationPath", () => {
  it("maps step property paths to the step node key", () => {
    expect(nodeKeyForValidationPath("steps.blur_1.image")).toBe("$steps.blur_1");
  });

  it("maps bare step paths (duplicate names) to the step node key", () => {
    expect(nodeKeyForValidationPath("steps.blur_1")).toBe("$steps.blur_1");
  });

  it("maps array-style output paths to the outputs node", () => {
    expect(nodeKeyForValidationPath("outputs[0].selector")).toBe("$outputs");
    expect(nodeKeyForValidationPath("outputs.output_image.selector")).toBe("$outputs");
    expect(nodeKeyForValidationPath("outputs")).toBe("$outputs");
  });

  it("maps input paths to the inputs node", () => {
    expect(nodeKeyForValidationPath("inputs[0].name")).toBe("$inputs");
  });

  it("returns null for unrelated or empty paths", () => {
    expect(nodeKeyForValidationPath("")).toBeNull();
    expect(nodeKeyForValidationPath("version")).toBeNull();
    expect(nodeKeyForValidationPath("metadata.ui")).toBeNull();
  });
});

describe("errorsForNodeKey", () => {
  it("collects prefixed messages for the matching node only", () => {
    const errors = [
      { code: "dangling_reference", path: "outputs.output_image.selector", message: "Dangling reference" },
      { code: "dangling_reference", path: "steps.blur_1.image", message: "Other node issue" },
    ];
    expect(errorsForNodeKey(errors, "$outputs")).toEqual([
      "outputs.output_image.selector: Dangling reference",
    ]);
    expect(errorsForNodeKey(errors, "$steps.blur_1")).toEqual([
      "steps.blur_1.image: Other node issue",
    ]);
    expect(errorsForNodeKey(errors, "$inputs")).toEqual([]);
  });

  it("keeps the bare message when the issue has no path", () => {
    expect(errorsForNodeKey([{ code: "invalid_spec", path: "", message: "Broken spec" }], "$outputs")).toEqual([]);
  });
});
