import { describe, expect, it } from "vitest";

import { specToGraph } from "./specToGraph";
import { SAMPLE_SPEC, buildTestRegistry, sampleSteps } from "./testUtils";

import type { WorkflowSpecification } from "../types/spec";

const registry = buildTestRegistry();

describe("specToGraph", () => {
  it("creates $inputs, one node per step and $outputs", () => {
    const { nodes } = specToGraph(SAMPLE_SPEC, registry);
    expect(nodes.map((node) => node.id)).toEqual([
      "$inputs",
      "$steps.detection",
      "$steps.label_visualization",
      "$outputs",
    ]);
    expect(nodes.map((node) => node.type)).toEqual([
      "workflowInput",
      "workflowStep",
      "workflowStep",
      "workflowOutput",
    ]);
    const inputNode = nodes[0]!;
    if (inputNode.data.kind !== "input") {
      throw new Error("expected input node");
    }
    expect(inputNode.data.inputs).toEqual([{ type: "WorkflowImage", name: "image" }]);
    const outputNode = nodes[3]!;
    if (outputNode.data.kind !== "output") {
      throw new Error("expected output node");
    }
    expect(outputNode.data.outputs.map((output) => output.name)).toEqual(["output_image", "detection_count"]);
  });

  it("derives edges from selector references with stable ids and node-level handles", () => {
    const { edges } = specToGraph(SAMPLE_SPEC, registry);
    expect(edges.map((edge) => edge.id).sort()).toEqual(
      [
        "$inputs~image~$steps.detection~images",
        "$inputs~image~$steps.label_visualization~image",
        "$steps.detection~predictions~$steps.label_visualization~predictions",
        "$steps.label_visualization~image~$outputs~output_image",
        "$steps.detection~predictions~$outputs~detection_count",
      ].sort(),
    );
    // Node-level handles (cloud builder): bottom "out" on the source, top "in"
    // on the consumer; the per-reference detail rides in edge data.
    const first = edges.find((edge) => edge.id === "$inputs~image~$steps.detection~images");
    expect(first).toMatchObject({
      source: "$inputs",
      sourceHandle: "out",
      target: "$steps.detection",
      targetHandle: "in",
      data: { sourceOutput: "image", targetInput: "images" },
    });
    const outputEdge = edges.find((edge) => edge.id === "$steps.detection~predictions~$outputs~detection_count");
    expect(outputEdge).toMatchObject({
      sourceHandle: "out",
      target: "$outputs",
      targetHandle: "in",
      data: { sourceOutput: "predictions", targetInput: "detection_count" },
    });
  });

  it("derives edges from selectors nested inside arrays", () => {
    const spec: WorkflowSpecification = {
      ...SAMPLE_SPEC,
      steps: [
        ...sampleSteps(),
        {
          type: "roboflow_core/roboflow_classifier@v1",
          name: "classifier",
          image: "$inputs.image",
          class_filter: ["$steps.detection.predictions", "person"],
        },
      ],
    };
    const { edges } = specToGraph(spec, registry);
    expect(edges).toContainEqual(
      expect.objectContaining({ id: "$steps.detection~predictions~$steps.classifier~class_filter" }),
    );
  });

  it("uses stored positions and dagre for nodes without coordinates", () => {
    const { nodes } = specToGraph(SAMPLE_SPEC, registry);
    const byId = new Map(nodes.map((node) => [node.id, node.position]));
    expect(byId.get("$inputs")).toEqual({ x: 0, y: 56 });
    expect(byId.get("$steps.detection")).toEqual({ x: 0, y: 292 });
    // Missing in fixture metadata: must be auto-laid out (finite numbers).
    const label = byId.get("$steps.label_visualization");
    const outputs = byId.get("$outputs");
    expect(label).toBeDefined();
    expect(outputs).toBeDefined();
    expect(Number.isFinite(label!.x)).toBe(true);
    expect(Number.isFinite(outputs!.x)).toBe(true);
  });

  it("computes deterministic coordinates for every node when metadata.ui is missing", () => {
    const spec: WorkflowSpecification = {
      version: "1.0",
      inputs: SAMPLE_SPEC.inputs,
      steps: SAMPLE_SPEC.steps,
      outputs: SAMPLE_SPEC.outputs,
    };
    const first = specToGraph(spec, registry);
    const second = specToGraph(spec, registry);
    expect(first.nodes.length).toBe(4);
    for (const node of first.nodes) {
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);
    }
    expect(first.nodes).toEqual(second.nodes);
  });

  it("marks nodes carrying dangling references", () => {
    // Keep only label_visualization: detection disappears while still referenced.
    const spec: WorkflowSpecification = {
      ...SAMPLE_SPEC,
      steps: [sampleSteps()[1]!],
    };
    const { nodes } = specToGraph(spec, registry);
    const outputNode = nodes.find((node) => node.id === "$outputs");
    if (outputNode?.data.kind !== "output") {
      throw new Error("expected output node");
    }
    expect(outputNode.data.danglingOutputs).toContain("detection_count");
    const stepNode = nodes.find((node) => node.id === "$steps.label_visualization");
    if (stepNode?.data.kind !== "step") {
      throw new Error("expected step node");
    }
    expect(stepNode.data.hasDanglingRef).toBe(true);
    const detectionNode = nodes.find((node) => node.id === "$steps.detection");
    expect(detectionNode).toBeUndefined();
  });

  it("exposes selector params and the cloud section from the registry", () => {
    const { nodes } = specToGraph(SAMPLE_SPEC, registry);
    const detection = nodes.find((node) => node.id === "$steps.detection");
    if (detection?.data.kind !== "step") {
      throw new Error("expected step node");
    }
    expect(detection.data.selectorProps).toContain("images");
    expect(detection.data.outputNames).toEqual(["predictions", "image"]);
    expect(detection.data.stepName).toBe("detection");
    // Fixture identifiers are not cloud identifiers -> gray fallback section.
    expect(detection.data.section).toBe("other");
  });
});
