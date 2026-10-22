import { describe, expect, it } from "vitest";

import { exportSpec } from "./exportSpec";
import { specToGraph } from "./specToGraph";
import { localValidate } from "./validation";
import { SAMPLE_SPEC, buildTestRegistry, sampleSteps } from "./testUtils";

import type { UiPosition, WorkflowSpecification } from "../types/spec";

const registry = buildTestRegistry();

describe("exportSpec round-trip", () => {
  it("preserves semantics and stores derived positions", () => {
    const graph = specToGraph(SAMPLE_SPEC, registry);
    const positions: Record<string, UiPosition> = {};
    for (const node of graph.nodes) {
      positions[node.id] = node.position;
    }
    const exported = exportSpec(SAMPLE_SPEC, positions);

    expect(exported.inputs).toEqual(SAMPLE_SPEC.inputs);
    expect(exported.outputs).toEqual(SAMPLE_SPEC.outputs);
    expect(exported.steps).toEqual(SAMPLE_SPEC.steps);
    expect(exported.metadata?.ui?.nodes?.["$inputs"]).toEqual({ x: 0, y: 56 });
    expect(exported.metadata?.ui?.nodes?.["$steps.detection"]).toEqual({ x: 0, y: 292 });
    // Previously-missing nodes now carry the auto-layout coordinates.
    expect(exported.metadata?.ui?.nodes?.["$outputs"]).toBeDefined();

    const edgeProjections = exported.metadata?.ui?.edges ?? [];
    expect(edgeProjections).toContainEqual({
      source: "$inputs",
      target: "$steps.detection",
      inputProperty: "images",
      sourceSelector: "image",
    });
    expect(edgeProjections).toContainEqual({
      source: "$steps.detection",
      target: "$outputs",
      inputProperty: "detection_count",
      sourceSelector: "predictions",
    });
    expect(exported.metadata?.ui?.groups).toEqual([]);
  });

  it("preserves notes and disabled keys", () => {
    const spec: WorkflowSpecification = {
      ...SAMPLE_SPEC,
      metadata: {
        ui: {
          nodes: { $inputs: { x: 0, y: 0 } },
          edges: [],
          groups: [],
          notes: [{ id: "n1", x: 1, y: 2, text: "note" }],
          disabled: ["$steps.detection"],
        },
      },
    };
    const exported = exportSpec(spec);
    expect(exported.metadata?.ui?.notes).toEqual([{ id: "n1", x: 1, y: 2, text: "note" }]);
    expect(exported.metadata?.ui?.disabled).toEqual(["$steps.detection"]);
  });

  it("round-trips through graph derivation without changing semantics", () => {
    const first = exportSpec(SAMPLE_SPEC);
    const graph = specToGraph(first, registry);
    const positions = Object.fromEntries(graph.nodes.map((node) => [node.id, node.position]));
    const second = exportSpec(first, positions);
    expect(second.inputs).toEqual(first.inputs);
    expect(second.outputs).toEqual(first.outputs);
    expect(second.steps).toEqual(first.steps);
    // Positions converge: after one graph pass every node has coordinates.
    expect(second.metadata?.ui?.nodes).toEqual(positions);
    const third = exportSpec(second);
    expect(third.metadata?.ui?.nodes).toEqual(second.metadata?.ui?.nodes);
    expect(third.metadata?.ui?.edges).toEqual(second.metadata?.ui?.edges);
  });
});

describe("localValidate", () => {
  it("passes the sample spec", () => {
    expect(localValidate(SAMPLE_SPEC, registry).errors).toEqual([]);
  });

  it("flags dangling references after deleting a referenced step", () => {
    const spec: WorkflowSpecification = {
      ...SAMPLE_SPEC,
      steps: [sampleSteps()[1]!],
    };
    const result = localValidate(spec);
    const paths = result.errors.map((error) => error.path);
    expect(paths).toContain("steps.label_visualization.predictions");
    expect(paths).toContain("outputs.detection_count.selector");
    expect(result.errors.every((error) => error.code === "dangling_reference")).toBe(true);
  });

  it("flags duplicate step names", () => {
    const spec: WorkflowSpecification = {
      ...SAMPLE_SPEC,
      steps: [
        ...sampleSteps(),
        { type: "roboflow_core/roboflow_label_visualization@v1", name: "detection" },
      ],
    };
    const result = localValidate(spec, registry);
    expect(result.errors.some((error) => error.code === "duplicate_step_name")).toBe(true);
  });
});
