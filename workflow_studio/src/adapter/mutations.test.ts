import { describe, expect, it } from "vitest";

import {
  addNote,
  addOutput,
  addStep,
  connectNodes,
  disconnectEdge,
  generateStepName,
  removeNode,
  removeOutput,
  removeNote,
  renameStep,
  setNodePosition,
  setOutputSelector,
  setParam,
  toggleDisabled,
  updateNote,
  addInput,
  moveInput,
  setInputDefault,
  removeInput,
  renameInput,
  renameOutput,
} from "./mutations";
import { specToGraph } from "./specToGraph";
import { SAMPLE_SPEC, buildTestRegistry, sampleSteps } from "./testUtils";

import type { WorkflowSpecification } from "../types/spec";
import { stepsToList } from "../types/spec";

const registry = buildTestRegistry();

describe("generateStepName", () => {
  it("derives the short name from the manifest identifier", () => {
    expect(generateStepName(SAMPLE_SPEC, "roboflow_core/roboflow_classifier@v1")).toBe("classifier");
  });

  it("dedupes with -1/-2 suffixes", () => {
    expect(generateStepName(SAMPLE_SPEC, "roboflow_core/roboflow_label_visualization@v1")).toBe(
      "label_visualization-1",
    );
  });
});

describe("addStep", () => {
  it("auto-binds the primary image input and auto-creates the step output", () => {
    const next = addStep(SAMPLE_SPEC, "roboflow_core/roboflow_classifier@v1", undefined, { x: 480, y: 100 }, registry);
    const step = stepsToList(next.steps).find((entry) => entry.name === "classifier");
    expect(step?.step.image).toBe("$inputs.image");
    expect(next.outputs).toContainEqual({
      type: "JsonField",
      name: "classifier_output",
      selector: "$steps.classifier.predictions",
    });
    expect(next.metadata?.ui?.nodes?.["$steps.classifier"]).toEqual({ x: 480, y: 100 });
  });

  it("does not duplicate an output binding that already exists", () => {
    const once = addStep(SAMPLE_SPEC, "roboflow_core/roboflow_classifier@v1", undefined, { x: 0, y: 0 }, registry);
    const twice = addStep(once, "roboflow_core/roboflow_classifier@v1", undefined, { x: 0, y: 0 }, registry);
    const bindings = (twice.outputs ?? []).filter((output) => output.selector.startsWith("$steps.classifier"));
    expect(bindings).toHaveLength(2);
    expect(bindings.map((output) => output.name)).toEqual(["classifier_output", "classifier-1_output"]);
    expect(stepsToList(twice.steps).map((entry) => entry.name)).toContain("classifier-1");
  });
});

describe("removeNode", () => {
  it("removes the step and its stored position", () => {
    const next = removeNode(SAMPLE_SPEC, "$steps.detection");
    expect(stepsToList(next.steps).map((entry) => entry.name)).toEqual(["label_visualization"]);
    expect(next.metadata?.ui?.nodes?.["$steps.detection"]).toBeUndefined();
    // Dangling references stay (cloud behavior: they block save until fixed).
    expect(next.outputs).toContainEqual({
      type: "JsonField",
      name: "detection_count",
      selector: "$steps.detection.predictions",
    });
  });

  it("keeps structural nodes", () => {
    expect(removeNode(SAMPLE_SPEC, "$inputs")).toBe(SAMPLE_SPEC);
    expect(removeNode(SAMPLE_SPEC, "$outputs")).toBe(SAMPLE_SPEC);
  });
});

describe("renameStep", () => {
  it("rewrites all selectors referencing the old name", () => {
    const next = renameStep(SAMPLE_SPEC, "detection", "det");
    const byName = new Map(stepsToList(next.steps).map((entry) => [entry.name, entry.step]));
    expect(byName.get("det")?.name).toBe("det");
    expect(byName.get("label_visualization")?.predictions).toBe("$steps.det.predictions");
    expect(next.outputs).toContainEqual({
      type: "JsonField",
      name: "detection_count",
      selector: "$steps.det.predictions",
    });
    expect(next.metadata?.ui?.nodes?.["$steps.det"]).toEqual({ x: 0, y: 292 });
    expect(next.metadata?.ui?.nodes?.["$steps.detection"]).toBeUndefined();
  });

  it("rewrites selectors nested in arrays", () => {
    const spec: WorkflowSpecification = {
      ...SAMPLE_SPEC,
      steps: [
        ...sampleSteps(),
        {
          type: "roboflow_core/roboflow_classifier@v1",
          name: "classifier",
          image: "$inputs.image",
          class_filter: ["$steps.detection.predictions"],
        },
      ],
    };
    const next = renameStep(spec, "detection", "det");
    const classifier = stepsToList(next.steps).find((entry) => entry.name === "classifier");
    expect(classifier?.step.class_filter).toEqual(["$steps.det.predictions"]);
  });

  it("refuses renames onto existing names", () => {
    expect(renameStep(SAMPLE_SPEC, "detection", "label_visualization")).toBe(SAMPLE_SPEC);
  });
});

describe("param and output mutations", () => {
  it("setParam writes and deletes", () => {
    const withValue = setParam(SAMPLE_SPEC, "detection", "confidence", 0.5);
    expect(stepsToList(withValue.steps).find((entry) => entry.name === "detection")?.step.confidence).toBe(0.5);
    const cleared = setParam(withValue, "detection", "confidence", undefined);
    expect("confidence" in (stepsToList(cleared.steps).find((entry) => entry.name === "detection")?.step ?? {})).toBe(false);
  });

  it("output add/remove/setSelector", () => {
    const added = addOutput(SAMPLE_SPEC);
    expect(added.outputs?.at(-1)).toMatchObject({ name: "output" });
    const withSelector = setOutputSelector(added, "output", "$inputs.image");
    expect(withSelector.outputs?.find((output) => output.name === "output")?.selector).toBe("$inputs.image");
    const removed = removeOutput(withSelector, "output");
    expect(removed.outputs?.find((output) => output.name === "output")).toBeUndefined();
  });
});

describe("notes and disabled", () => {
  it("adds, updates and removes notes in metadata.ui.notes", () => {
    const withNote = addNote(SAMPLE_SPEC, { id: "n1", x: 12, y: 34, text: "hello" });
    expect(withNote.metadata?.ui?.notes).toEqual([{ id: "n1", x: 12, y: 34, text: "hello" }]);
    const updated = updateNote(withNote, "n1", { text: "changed", x: 56 });
    expect(updated.metadata?.ui?.notes).toEqual([{ id: "n1", x: 56, y: 34, text: "changed" }]);
    expect(removeNote(updated, "n1").metadata?.ui?.notes).toEqual([]);
  });

  it("toggles disabled node keys", () => {
    const disabled = toggleDisabled(SAMPLE_SPEC, "$steps.detection");
    expect(disabled.metadata?.ui?.disabled).toEqual(["$steps.detection"]);
    expect(toggleDisabled(disabled, "$steps.detection").metadata?.ui?.disabled).toEqual([]);
  });

  it("setNodePosition writes coordinates", () => {
    const next = setNodePosition(SAMPLE_SPEC, "$outputs", 640, 120);
    expect(next.metadata?.ui?.nodes?.["$outputs"]).toEqual({ x: 640, y: 120 });
  });
});

describe("connectNodes (edge drag -> binding)", () => {
  it("binds the first unset kind-compatible selector property from $inputs", () => {
    const spec: WorkflowSpecification = {
      ...SAMPLE_SPEC,
      steps: [...sampleSteps(), { type: "roboflow_core/roboflow_classifier@v1", name: "classifier" }],
    };
    const next = connectNodes(spec, "$inputs", "$steps.classifier", registry);
    const classifier = stepsToList(next.steps).find((entry) => entry.name === "classifier");
    expect(classifier?.step.image).toBe("$inputs.image");
  });

  it("uses the source step's first manifest output as the bound selector", () => {
    const next = connectNodes(SAMPLE_SPEC, "$steps.detection", "$steps.label_visualization", registry);
    // label_visualization.image is set and predictions is set: no unset selector
    // property remains -> the primary image-ish property is replaced.
    const label = stepsToList(next.steps).find((entry) => entry.name === "label_visualization");
    expect(label?.step.image).toBe("$steps.detection.predictions");
  });

  it("appends an output row when connecting into the outputs node", () => {
    const next = connectNodes(SAMPLE_SPEC, "$steps.detection", "$outputs", registry);
    expect(next.outputs).toContainEqual({
      type: "JsonField",
      name: "detection_output",
      selector: "$steps.detection.predictions",
    });
  });

  it("is a no-op on self-connection, unknown targets and selector-less blocks", () => {
    expect(connectNodes(SAMPLE_SPEC, "$steps.detection", "$steps.detection", registry)).toBe(SAMPLE_SPEC);
    expect(connectNodes(SAMPLE_SPEC, "$inputs", "$steps.missing", registry)).toBe(SAMPLE_SPEC);
    const withPure: WorkflowSpecification = {
      ...SAMPLE_SPEC,
      steps: [...sampleSteps(), { type: "roboflow_core/pure_compute@v1", name: "pure" }],
    };
    expect(connectNodes(withPure, "$inputs", "$steps.pure", registry)).toBe(withPure);
  });
});

describe("disconnectEdge (edge removal -> unbinding)", () => {
  it("clears the step property that held the reference", () => {
    const { edges } = specToGraph(SAMPLE_SPEC, registry);
    const edge = edges.find((item) => item.id === "$inputs~image~$steps.detection~images");
    expect(edge).toBeDefined();
    const next = disconnectEdge(SAMPLE_SPEC, edge!);
    const detection = stepsToList(next.steps).find((entry) => entry.name === "detection");
    expect("images" in (detection?.step ?? {})).toBe(false);
    // The unrelated binding on label_visualization stays intact.
    const label = stepsToList(next.steps).find((entry) => entry.name === "label_visualization");
    expect(label?.step.image).toBe("$inputs.image");
  });

  it("removes the outputs row for an edge into $outputs", () => {
    const { edges } = specToGraph(SAMPLE_SPEC, registry);
    const edge = edges.find((item) => item.id === "$steps.detection~predictions~$outputs~detection_count");
    expect(edge).toBeDefined();
    const next = disconnectEdge(SAMPLE_SPEC, edge!);
    expect(next.outputs?.map((output) => output.name)).toEqual(["output_image"]);
  });

  it("falls back to parsing the edge id when data is missing", () => {
    const next = disconnectEdge(SAMPLE_SPEC, {
      id: "$inputs~image~$steps.detection~images",
      source: "$inputs",
      target: "$steps.detection",
    });
    const detection = stepsToList(next.steps).find((entry) => entry.name === "detection");
    expect("images" in (detection?.step ?? {})).toBe(false);
  });

  it("is a no-op for edges without recoverable references", () => {
    expect(disconnectEdge(SAMPLE_SPEC, { id: "???" })).toBe(SAMPLE_SPEC);
  });
});

describe("immutability", () => {
  it("mutations never modify the input spec", () => {
    const snapshot = JSON.stringify(SAMPLE_SPEC);
    addStep(SAMPLE_SPEC, "roboflow_core/roboflow_classifier@v1", undefined, { x: 1, y: 2 }, registry);
    renameStep(SAMPLE_SPEC, "detection", "x");
    setParam(SAMPLE_SPEC, "detection", "confidence", 1);
    removeNode(SAMPLE_SPEC, "$steps.detection");
    toggleDisabled(SAMPLE_SPEC, "$steps.detection");
    connectNodes(SAMPLE_SPEC, "$inputs", "$steps.label_visualization", registry);
    disconnectEdge(SAMPLE_SPEC, { id: "$inputs~image~$steps.detection~images" });
    expect(JSON.stringify(SAMPLE_SPEC)).toBe(snapshot);
  });

describe("workflow input/output mutations", () => {
  function specWithInput() {
    return {
      version: "1.0" as const,
      inputs: [{ type: "WorkflowImage", name: "image" }],
      steps: [
        {
          type: "roboflow_core/brightness_contrast@v1",
          name: "bc",
          image: "$inputs.image",
        },
      ],
      outputs: [{ type: "JsonField", name: "out", selector: "$steps.bc.image" }],
    };
  }

  it("adds named inputs and de-duplicates colliding names", () => {
    const next = addInput(addInput(specWithInput(), "confidence", "WorkflowParameter"), "confidence", "WorkflowParameter");
    expect(next.inputs?.map((input) => input.name)).toEqual(["image", "confidence", "confidence_2"]);
  });

  it("parameter inputs carry the kind annotation and default value", () => {
    const next = addInput(specWithInput(), "confidence", "WorkflowParameter", ["string"], "high");
    expect(next.inputs?.[1]).toEqual({
      type: "WorkflowParameter",
      name: "confidence",
      kind: ["string"],
      default_value: "high",
    });
  });

  it("moves an input to another index", () => {
    const spec = addInput(specWithInput(), "confidence", "WorkflowParameter");
    const next = moveInput(spec, "image", 1);
    expect(next.inputs?.map((input) => input.name)).toEqual(["confidence", "image"]);
    expect(moveInput(spec, "image", 0)).toBe(spec);
  });

  it("sets and clears a parameter default", () => {
    const spec = addInput(specWithInput(), "confidence", "WorkflowParameter", ["number"], 0.5);
    const cleared = setInputDefault(spec, "confidence", undefined);
    expect(cleared.inputs?.[1]).toEqual({ type: "WorkflowParameter", name: "confidence" });
    const updated = setInputDefault(spec, "confidence", false, ["boolean"]);
    expect(updated.inputs?.[1]).toEqual({
      type: "WorkflowParameter",
      name: "confidence",
      kind: ["boolean"],
      default_value: false,
    });
  });

  it("image inputs omit kind and default value", () => {
    const next = addInput(specWithInput(), "second_image", "WorkflowImage");
    expect(next.inputs?.[1]).toEqual({ type: "WorkflowImage", name: "second_image" });
  });

  it("removing an input leaves references dangling for the validator", () => {
    const next = removeInput(specWithInput(), "image");
    expect(next.inputs).toEqual([]);
    expect(stepsToList(next.steps)[0]!.step).toMatchObject({ image: "$inputs.image" });
  });

  it("renaming an input rewrites $inputs references in steps and outputs", () => {
    const next = renameInput(specWithInput(), "image", "photo");
    expect(next.inputs?.[0]).toEqual({ type: "WorkflowImage", name: "photo" });
    expect(stepsToList(next.steps)[0]!.step).toMatchObject({ image: "$inputs.photo" });
  });

  it("renaming an output only renames the row", () => {
    const next = renameOutput(specWithInput(), "out", "result");
    expect(next.outputs?.[0]).toEqual({ type: "JsonField", name: "result", selector: "$steps.bc.image" });
  });

  it("rename guards reject empty and colliding names", () => {
    const spec = specWithInput();
    expect(renameInput(spec, "image", " image ")).toBe(spec);
    expect(renameInput(spec, "image", "")).toBe(spec);
    const two = { ...spec, inputs: [...spec.inputs, { type: "WorkflowData", name: "data" }] };
    expect(renameInput(two, "image", "data")).toBe(two);
  });
});
});
