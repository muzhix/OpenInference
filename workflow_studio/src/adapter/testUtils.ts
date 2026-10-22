/** Shared fixtures for adapter tests. */

import type { BlockDescriptor, BlockRegistry, KindConnection } from "../types/registry";
import type { WorkflowSpecification, WorkflowStepSpec } from "../types/spec";
import { stepsToList } from "../types/spec";

export const SAMPLE_SPEC: WorkflowSpecification = {
  version: "1.0",
  inputs: [{ type: "WorkflowImage", name: "image" }],
  steps: [
    {
      type: "roboflow_core/roboflow_object_detection@v2",
      name: "detection",
      images: "$inputs.image",
      model_id: "smoking-detection/1",
      confidence: 0.4,
    },
    {
      type: "roboflow_core/roboflow_label_visualization@v1",
      name: "label_visualization",
      image: "$inputs.image",
      predictions: "$steps.detection.predictions",
    },
  ],
  outputs: [
    { type: "JsonField", name: "output_image", selector: "$steps.label_visualization.image" },
    { type: "JsonField", name: "detection_count", selector: "$steps.detection.predictions" },
  ],
  metadata: {
    ui: {
      nodes: {
        $inputs: { x: 0, y: 56 },
        "$steps.detection": { x: 0, y: 292 },
      },
      edges: [
        { source: "$inputs", target: "$steps.detection", inputProperty: "images", sourceSelector: "image" },
      ],
      groups: [],
    },
  },
};

/** Sample steps as a plain array for building test variants. */
export function sampleSteps(): WorkflowStepSpec[] {
  return stepsToList(SAMPLE_SPEC.steps).map((entry) => ({ ...entry.step }));
}

function block(
  manifestType: string,
  properties: string[],
  outputs: string[],
): BlockDescriptor {  return {
    manifest_type_identifier: manifestType,
    block_schema: {
      type: "object",
      name: manifestType.split("/").pop()?.split("@")[0],
      properties: Object.fromEntries(
        properties.map((name) => [name, { type: "string", description: `${name} param` }]),
      ),
      required: [],
    },
    outputs_manifest: outputs.map((name) => ({ name, kind: [{ name: "roboflow_core/*" }] })),
  };
}

export function buildTestRegistry(): BlockRegistry {
  const detection = block(
    "roboflow_core/roboflow_object_detection@v2",
    ["images", "model_id", "confidence"],
    ["predictions", "image"],
  );
  const labelVisualization = block(
    "roboflow_core/roboflow_label_visualization@v1",
    ["image", "predictions"],
    ["image"],
  );
  const classifier = block(
    "roboflow_core/roboflow_classifier@v1",
    ["image", "model_id"],
    ["predictions"],
  );
  /** Selector-less block: no kind connections and no heuristic param names. */
  const pureCompute = block(
    "roboflow_core/pure_compute@v1",
    ["factor", "mode"],
    [],
  );
  const kindsConnections: Record<string, KindConnection[]> = {
    image: [
      { manifest_type_identifier: detection.manifest_type_identifier, property_name: "images" },
      { manifest_type_identifier: labelVisualization.manifest_type_identifier, property_name: "image" },
      { manifest_type_identifier: classifier.manifest_type_identifier, property_name: "image" },
    ],
  };
  return {
    blocks: [detection, labelVisualization, classifier, pureCompute],
    declared_kinds: [{ name: "image" }],
    kinds_connections: kindsConnections,
  };
}
