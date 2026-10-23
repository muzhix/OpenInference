import { describe, expect, it } from "vitest";

import {
  addNote,
  addBoundOutput,
  addOutput,
  nextOutputName,
  addStep,
  connectNodes,
  disconnectConnection,
  disconnectEdge,
  spliceBlock,
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
import { deriveEdges } from "./edges";
import { specToGraph } from "./specToGraph";
import { SAMPLE_SPEC, buildTestRegistry, sampleSteps } from "./testUtils";

import type { BlockRegistry } from "../types/registry";
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

  it("addBoundOutput names a blank row from the selector and suffixes the next one _2", () => {
    const added = addBoundOutput(SAMPLE_SPEC, "", "$steps.detection.predictions");
    expect(added.outputs?.at(-1)).toMatchObject({
      name: "detection_output",
      selector: "$steps.detection.predictions",
    });
    const second = addBoundOutput(added, "detection_output", "$steps.detection.inference_id");
    expect(second.outputs?.at(-1)).toMatchObject({
      name: "detection_output_2",
      selector: "$steps.detection.inference_id",
    });
    expect(nextOutputName(["detection_output", "detection_output_2"], "detection")).toBe("detection_output_3");
  });

  it("stores all_properties as the engine wildcard so the output is one JSON object", () => {
    const added = addBoundOutput(SAMPLE_SPEC, "detection_object", "$steps.detection.all_properties");
    expect(added.outputs?.at(-1)).toMatchObject({
      name: "detection_object",
      selector: "$steps.detection.*",
    });
    const rebound = setOutputSelector(added, "output_image", "$steps.detection.all_properties");
    expect(rebound.outputs?.find((output) => output.name === "output_image")?.selector).toBe("$steps.detection.*");
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

  it("appends a second outputs-node binding as <step>_output_2", () => {
    const once = connectNodes(SAMPLE_SPEC, "$steps.detection", "$outputs", registry);
    const twice = connectNodes(once, "$steps.detection", "$outputs", registry);
    expect(twice.outputs?.map((output) => output.name)).toEqual([
      "output_image",
      "detection_count",
      "detection_output",
      "detection_output_2",
    ]);
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

  it("clears every field bound on one visual connection", () => {
    const spec: WorkflowSpecification = {
      ...SAMPLE_SPEC,
      steps: sampleSteps().map((step) =>
        step.name === "label_visualization"
          ? { ...step, image: "$steps.detection.image", predictions: "$steps.detection.predictions" }
          : step,
      ),
    };
    const next = disconnectConnection(spec, {
      source: "$steps.detection",
      target: "$steps.label_visualization",
      data: {
        sourceOutput: "image",
        targetInput: "image",
        bindings: [
          { sourceOutput: "image", targetInput: "image" },
          { sourceOutput: "predictions", targetInput: "predictions" },
        ],
      },
    });
    const label = stepsToList(next.steps).find((entry) => entry.name === "label_visualization");
    expect(label?.step.image).toBeUndefined();
    expect(label?.step.predictions).toBeUndefined();
  });
});

describe("spliceBlock", () => {
  it("inserts the block on the connection and retargets a matching output", () => {
    const spec: WorkflowSpecification = {
      ...SAMPLE_SPEC,
      metadata: {
        ui: {
          nodes: {
            $inputs: { x: 0, y: 0 },
            "$steps.detection": { x: 0, y: 200 },
            "$steps.label_visualization": { x: 0, y: 400 },
            $outputs: { x: 0, y: 600 },
          },
        },
      },
    };
    const next = spliceBlock(
      spec,
      "roboflow_core/roboflow_classifier@v1",
      {
        sourceId: "$steps.detection",
        targetId: "$steps.label_visualization",
        position: { x: 0, y: 300 },
        shiftedPositions: {
          $inputs: { x: 0, y: 0 },
          "$steps.detection": { x: 0, y: 200 },
          "$steps.label_visualization": { x: 0, y: 520 },
          $outputs: { x: 0, y: 720 },
        },
      },
      registry,
    );
    const label = stepsToList(next.steps).find((entry) => entry.name === "label_visualization");
    const inserted = stepsToList(next.steps).find((entry) => entry.name === "classifier");
    expect(inserted?.step.image).toBe("$steps.detection.predictions");
    expect(label?.step.predictions).toBe("$steps.classifier.predictions");
    expect(label?.step.image).toBe("$inputs.image");
    expect(next.metadata?.ui?.nodes?.["$steps.classifier"]).toEqual({ x: 0, y: 300 });
    expect(next.metadata?.ui?.nodes?.["$steps.label_visualization"]).toEqual({ x: 0, y: 520 });
    expect(edgesBetween(next, "$steps.detection", "$steps.label_visualization")).toEqual([]);
    expect(edgesBetween(next, "$steps.classifier", "$steps.label_visualization").length).toBeGreaterThan(0);
  });

  it("replaces the original connection when the new block's output names differ", () => {
    const cropType = "roboflow_core/crop@v1";
    const cropRegistry: BlockRegistry = {
      ...registry,
      blocks: [
        ...registry.blocks,
        {
          manifest_type_identifier: cropType,
          block_schema: {
            type: "object",
            properties: { image: { type: "string" } },
            required: [],
          },
          outputs_manifest: [{ name: "crops", kind: [{ name: "image" }] }],
        },
      ],
      kinds_connections: {
        ...registry.kinds_connections,
        image: [
          ...(registry.kinds_connections.image ?? []),
          { manifest_type_identifier: cropType, property_name: "image" },
        ],
      },
    };
    const next = spliceBlock(SAMPLE_SPEC, cropType, {
      sourceId: "$steps.detection",
      targetId: "$steps.label_visualization",
      position: { x: 0, y: 300 },
      shiftedPositions: {},
    }, cropRegistry);
    const inserted = stepsToList(next.steps).find((entry) => entry.name === "crop");
    const label = stepsToList(next.steps).find((entry) => entry.name === "label_visualization");
    expect(inserted?.step.image).toBe("$steps.detection.predictions");
    expect(label?.step.predictions).toBe("$steps.crop.crops");
    expect(label?.step.image).toBe("$inputs.image");
    expect(edgesBetween(next, "$steps.detection", "$steps.label_visualization")).toEqual([]);
    expect(edgesBetween(next, "$steps.detection", "$steps.crop").map((edge) => edge.targetInput)).toEqual(["image"]);
    expect(edgesBetween(next, "$steps.crop", "$steps.label_visualization").map((edge) => edge.targetInput)).toEqual([
      "predictions",
    ]);
  });
});

function edgesBetween(spec: WorkflowSpecification, source: string, target: string) {
  return deriveEdges(spec).filter((edge) => edge.source === source && edge.target === target);
}

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
