import { describe, expect, it } from "vitest";

import { STEP_CARD_HEIGHT, computeAutoLayout, insertSlotGeometry } from "./layout";
import { SAMPLE_SPEC } from "./testUtils";

import type { WorkflowSpecification } from "../types/spec";

const IDS = ["$inputs", "$steps.detection", "$steps.label_visualization", "$outputs"];
const MIN_CARD_HEIGHT = 96;

function bareSpec(): WorkflowSpecification {
  return { ...SAMPLE_SPEC, metadata: { ui: {} } };
}

describe("computeAutoLayout (top to bottom)", () => {
  it("gives every node a distinct position when several steps lack stored coordinates", () => {
    const positions = computeAutoLayout(bareSpec(), IDS);

    expect(Object.keys(positions).sort()).toEqual([...IDS].sort());
    const coordinates = IDS.map((id) => `${positions[id]!.x},${positions[id]!.y}`);
    expect(new Set(coordinates).size).toBe(IDS.length);
  });

  it("flows inputs at the top, steps below along selector edges, outputs at the bottom", () => {
    const positions = computeAutoLayout(bareSpec(), IDS);

    // Reduced flow is a chain: inputs → detection → label_visualization → outputs.
    // label_visualization still reads $inputs.image, and outputs still reads
    // detection.predictions, without extra lines.
    expect(positions.$inputs!.y).toBeLessThan(positions["$steps.detection"]!.y);
    expect(positions["$steps.detection"]!.y).toBeLessThan(positions["$steps.label_visualization"]!.y);
    expect(positions.$outputs!.y).toBeGreaterThanOrEqual(positions["$steps.label_visualization"]!.y);
  });

  it("spaces card boxes so nodes in distinct ranks never overlap vertically", () => {
    const positions = computeAutoLayout(bareSpec(), IDS);
    const tops = IDS.map((id) => positions[id]!.y).sort((a, b) => a - b);

    for (let index = 1; index < tops.length; index += 1) {
      expect(tops[index]!).toBeGreaterThanOrEqual(tops[index - 1]! + MIN_CARD_HEIGHT);
    }
  });

  it("is deterministic", () => {
    expect(computeAutoLayout(bareSpec(), IDS)).toEqual(computeAutoLayout(bareSpec(), IDS));
  });

  it("stacks a chain in one column when later steps also read earlier ancestors", () => {
    const spec: WorkflowSpecification = {
      version: "1.0",
      inputs: [{ type: "WorkflowImage", name: "image" }],
      steps: [
        { type: "roboflow_core/roboflow_object_detection@v2", name: "model", images: "$inputs.image" },
        {
          type: "roboflow_core/bounding_box_visualization@v1",
          name: "bounding_box_visualization",
          image: "$inputs.image",
          predictions: "$steps.model.predictions",
        },
        {
          type: "roboflow_core/label_visualization@v1",
          name: "label_visualization",
          image: "$steps.bounding_box_visualization.image",
          predictions: "$steps.model.predictions",
        },
      ],
      outputs: [{ type: "JsonField", name: "output_image", selector: "$steps.label_visualization.image" }],
    };
    const ids = [
      "$inputs",
      "$steps.model",
      "$steps.bounding_box_visualization",
      "$steps.label_visualization",
      "$outputs",
    ];
    const positions = computeAutoLayout(spec, ids);
    expect(new Set(ids.map((id) => positions[id]!.x)).size).toBe(1);
    expect(positions.$inputs!.y).toBeLessThan(positions["$steps.model"]!.y);
    expect(positions["$steps.model"]!.y).toBeLessThan(positions["$steps.bounding_box_visualization"]!.y);
    expect(positions["$steps.bounding_box_visualization"]!.y).toBeLessThan(positions["$steps.label_visualization"]!.y);
    expect(positions["$steps.label_visualization"]!.y).toBeLessThan(positions.$outputs!.y);
  });

  it("leaves 1.5 step-cards of space between stacked step nodes", () => {
    const spec: WorkflowSpecification = {
      version: "1.0",
      inputs: [],
      steps: [
        { type: "roboflow_core/roboflow_object_detection@v2", name: "a" },
        { type: "roboflow_core/roboflow_label_visualization@v1", name: "b", image: "$steps.a.image" },
      ],
      outputs: [],
    };
    const positions = computeAutoLayout(spec, ["$steps.a", "$steps.b"]);
    expect(positions["$steps.b"]!.y - positions["$steps.a"]!.y).toBe(STEP_CARD_HEIGHT * 2.5);
  });
});

describe("insertSlotGeometry", () => {
  it("opens a card-sized slot with a 1.5-card gap on either side", () => {
    const slot = insertSlotGeometry({ x: 10, y: 0, height: STEP_CARD_HEIGHT }, STEP_CARD_HEIGHT * 2.5);
    expect(slot).toEqual({
      x: 10,
      y: STEP_CARD_HEIGHT * 2.5,
      minY: STEP_CARD_HEIGHT * 2.5,
      dy: STEP_CARD_HEIGHT * 2.5,
    });
  });

  it("does not pull a target upward when the gap is already large enough", () => {
    const slot = insertSlotGeometry({ x: 0, y: 0, height: STEP_CARD_HEIGHT }, 400);
    expect(slot.dy).toBe(0);
    expect(slot.y).toBe(STEP_CARD_HEIGHT * 2.5);
  });
});
