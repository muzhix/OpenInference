import { describe, expect, it } from "vitest";

import { buildSelectorGroups } from "./SelectorPicker";

import type { BlockRegistry } from "../../types/registry";
import type { WorkflowSpecification, WorkflowStepSpec } from "../../types/spec";

const DETECTION = "roboflow_core/roboflow_object_detection_model@v3";
const CROP = "roboflow_core/crop@v1";

function registry(): BlockRegistry {
  return {
    blocks: [
      {
        manifest_type_identifier: DETECTION,
        block_schema: { ui_manifest: { icon: "far fa-chart-network", section: "model" } },
        outputs_manifest: [
          { name: "inference_id", kind: [{ name: "inference_id" }] },
          { name: "predictions", kind: [{ name: "object_detection_prediction" }] },
          { name: "model_id", kind: [{ name: "roboflow_model_id" }] },
        ],
      },
      {
        manifest_type_identifier: CROP,
        block_schema: { ui_manifest: { icon: "far fa-crop", section: "transformation" } },
        outputs_manifest: [{ name: "image", kind: [{ name: "image" }] }],
      },
    ],
    declared_kinds: [],
    kinds_connections: {
      image: [
        { manifest_type_identifier: DETECTION, property_name: "images" },
        { manifest_type_identifier: CROP, property_name: "image" },
      ],
      object_detection_prediction: [{ manifest_type_identifier: CROP, property_name: "predictions" }],
    },
  };
}

function spec(steps: WorkflowStepSpec[]): WorkflowSpecification {
  return {
    version: "1.0",
    inputs: [
      { type: "WorkflowImage", name: "image" },
      { type: "WorkflowParameter", name: "confidence" },
    ],
    steps,
    outputs: [],
  };
}

function selectors(steps: WorkflowStepSpec[], property: string, stepName: string): string[] {
  return buildSelectorGroups(spec(steps), registry(), property, stepName).flatMap((group) =>
    group.rows.map((row) => row.selector),
  );
}

describe("buildSelectorGroups", () => {
  it("offers only the image input on a detection model's Select image field", () => {
    const steps: WorkflowStepSpec[] = [{ type: DETECTION, name: "model" }];
    const groups = buildSelectorGroups(spec(steps), registry(), "images", "model");
    expect(groups.map((group) => group.title)).toEqual(["inputs"]);
    expect(groups[0]?.header).toBe("inputs");
    expect(selectors(steps, "images", "model")).toEqual(["$inputs.image"]);
  });

  it("includes an upstream image output and hides non-image model outputs", () => {
    const steps: WorkflowStepSpec[] = [
      { type: DETECTION, name: "model" },
      { type: CROP, name: "crop" },
      { type: DETECTION, name: "next" },
    ];
    expect(selectors(steps, "images", "next")).toEqual(["$inputs.image", "$steps.crop.image"]);
  });

  it("keeps a prediction output on a predictions field", () => {
    const steps: WorkflowStepSpec[] = [
      { type: DETECTION, name: "model" },
      { type: CROP, name: "crop" },
    ];
    expect(selectors(steps, "predictions", "crop")).toEqual(["$steps.model.predictions"]);
  });
});
