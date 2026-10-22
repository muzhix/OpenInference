import { describe, expect, it } from "vitest";

import { computeAutoLayout } from "./layout";
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

    // $inputs feeds detection (via images), detection feeds label_visualization
    // (via predictions), and both feed the outputs node.
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
});
