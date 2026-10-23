import { describe, expect, it } from "vitest";

import { specToGraph } from "../../adapter";
import { SAMPLE_SPEC, buildTestRegistry, sampleSteps } from "../../adapter/testUtils";

import type { WorkflowSpecification } from "../../types/spec";
import { clearedFieldsTip, confirmClearMessage, groupFlowEdges, removalWarning } from "./flowEdges";

const registry = buildTestRegistry();

describe("groupFlowEdges", () => {
  it("draws one edge per node pair and keeps every binding", () => {
    const spec: WorkflowSpecification = {
      ...SAMPLE_SPEC,
      steps: sampleSteps().map((step) =>
        step.name === "label_visualization"
          ? { ...step, image: "$steps.detection.image", predictions: "$steps.detection.predictions" }
          : step,
      ),
    };
    const grouped = groupFlowEdges(specToGraph(spec, registry).edges);
    const pair = grouped.find(
      (edge) => edge.source === "$steps.detection" && edge.target === "$steps.label_visualization",
    );
    expect(pair?.type).toBe("flow");
    expect(pair?.data?.bindings?.map((binding) => binding.targetInput).sort()).toEqual(["image", "predictions"]);
    expect(grouped.filter((edge) => edge.source === "$steps.detection" && edge.target === "$steps.label_visualization")).toHaveLength(1);
  });
});

describe("connection copy", () => {
  it("describes the fields a removal clears", () => {
    expect(removalWarning(["image", "predictions"], "$steps.bounding_box_visualization")).toBe(
      "Warning: Removing this connection will clear 2 input fields: image, predictions",
    );
    expect(confirmClearMessage(2, "$steps.bounding_box_visualization")).toBe(
      "Will clear 2 properties from bounding_box_visualization node",
    );
    expect(clearedFieldsTip(["image", "predictions"])).toBe("Will clear: image, predictions");
  });
});
