import { describe, expect, it } from "vitest";

import { downstreamNodeIds, flowEdges } from "./edges";

import type { WorkflowSpecification } from "../types/spec";

function pairs(spec: WorkflowSpecification): string[] {
  return [...new Set(flowEdges(spec).map((edge) => `${edge.source}->${edge.target}`))].sort();
}

describe("flowEdges", () => {
  it("draws one chain when visualization reads the image and the model", () => {
    const spec: WorkflowSpecification = {
      version: "1.0",
      inputs: [{ type: "WorkflowImage", name: "image" }],
      steps: [
        {
          type: "roboflow_core/roboflow_object_detection_model@v3",
          name: "model",
          images: "$inputs.image",
        },
        {
          type: "roboflow_core/bounding_box_visualization@v1",
          name: "bounding_box_visualization",
          image: "$inputs.image",
          predictions: "$steps.model.predictions",
        },
        {
          type: "roboflow_core/label_visualization@v2",
          name: "label_visualization",
          image: "$steps.bounding_box_visualization.image",
          predictions: "$steps.model.predictions",
        },
      ],
      outputs: [
        { type: "JsonField", name: "model_output", selector: "$steps.model.predictions" },
        { type: "JsonField", name: "label_output", selector: "$steps.label_visualization.image" },
      ],
    };
    expect(pairs(spec)).toEqual(
      [
        "$inputs->$steps.model",
        "$steps.model->$steps.bounding_box_visualization",
        "$steps.bounding_box_visualization->$steps.label_visualization",
        "$steps.label_visualization->$outputs",
      ].sort(),
    );
  });

  it("matches the cloud builder chain when labels are drawn before boxes", () => {
    const spec: WorkflowSpecification = {
      version: "1.0",
      inputs: [{ type: "InferenceImage", name: "image" }],
      steps: [
        {
          type: "roboflow_core/roboflow_object_detection_model@v3",
          name: "model",
          images: "$inputs.image",
        },
        {
          type: "roboflow_core/bounding_box_visualization@v1",
          name: "bounding_box_visualization",
          image: "$steps.label_visualization.image",
          predictions: "$steps.model.predictions",
        },
        {
          type: "roboflow_core/label_visualization@v2",
          name: "label_visualization",
          image: "$inputs.image",
          predictions: "$steps.model.predictions",
        },
      ],
      outputs: [
        { type: "JsonField", name: "model_output", selector: "$steps.model.predictions" },
        { type: "JsonField", name: "bounding_box_visualization_output", selector: "$steps.bounding_box_visualization.image" },
      ],
    };
    expect(pairs(spec)).toEqual(
      [
        "$inputs->$steps.model",
        "$steps.model->$steps.label_visualization",
        "$steps.label_visualization->$steps.bounding_box_visualization",
        "$steps.bounding_box_visualization->$outputs",
      ].sort(),
    );
  });

  it("keeps a fork when two models both read the input", () => {
    const spec: WorkflowSpecification = {
      version: "1.0",
      inputs: [{ type: "WorkflowImage", name: "image" }],
      steps: [
        { type: "roboflow_core/roboflow_object_detection_model@v3", name: "model_a", images: "$inputs.image" },
        { type: "roboflow_core/roboflow_object_detection_model@v3", name: "model_b", images: "$inputs.image" },
      ],
      outputs: [],
    };
    expect(pairs(spec)).toEqual(["$inputs->$steps.model_a", "$inputs->$steps.model_b"].sort());
  });

  it("keeps every direct binding between a pair that has no longer path", () => {
    const spec: WorkflowSpecification = {
      version: "1.0",
      inputs: [{ type: "WorkflowImage", name: "image" }],
      steps: [
        { type: "roboflow_core/roboflow_object_detection@v2", name: "detection", images: "$inputs.image" },
        {
          type: "roboflow_core/label_visualization@v1",
          name: "label_visualization",
          image: "$steps.detection.image",
          predictions: "$steps.detection.predictions",
        },
      ],
      outputs: [],
    };
    const bindings = flowEdges(spec).filter(
      (edge) => edge.source === "$steps.detection" && edge.target === "$steps.label_visualization",
    );
    expect(bindings.map((edge) => edge.targetInput).sort()).toEqual(["image", "predictions"]);
  });
});

describe("downstreamNodeIds", () => {
  it("treats later visualization steps as successors of the box step", () => {
    const spec: WorkflowSpecification = {
      version: "1.0",
      inputs: [{ type: "WorkflowImage", name: "image" }],
      steps: [
        {
          type: "roboflow_core/roboflow_object_detection_model@v3",
          name: "model",
          images: "$inputs.image",
        },
        {
          type: "roboflow_core/bounding_box_visualization@v1",
          name: "bounding_box_visualization",
          image: "$inputs.image",
          predictions: "$steps.model.predictions",
        },
        {
          type: "roboflow_core/label_visualization@v2",
          name: "label_visualization",
          image: "$steps.bounding_box_visualization.image",
          predictions: "$steps.model.predictions",
        },
      ],
      outputs: [{ type: "JsonField", name: "label_output", selector: "$steps.label_visualization.image" }],
    };
    const downstream = downstreamNodeIds(spec, "$steps.bounding_box_visualization");
    expect(downstream.has("$steps.label_visualization")).toBe(true);
    expect(downstream.has("$steps.model")).toBe(false);
    expect(downstream.has("$inputs")).toBe(false);
    expect(downstreamNodeIds(spec, "$steps.label_visualization").has("$steps.bounding_box_visualization")).toBe(false);
  });
});
