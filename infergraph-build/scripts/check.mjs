/**
 * Pure-function checks for InferGraph Build workflow serialization + templates.
 * Run: npm run check
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function canvasToSpecification(nodes, edges) {
  const steps = nodes.map((node) => {
    const step = {
      type: node.data.blockType,
      name: node.id,
      ...node.data.params,
    };
    for (const edge of edges.filter((e) => e.target === node.id)) {
      const prop = edge.targetHandle || "image";
      const sourceOut = edge.sourceHandle || "predictions";
      if (edge.source.startsWith("input:")) {
        step[prop] = `$inputs.${edge.source.slice("input:".length)}`;
      } else {
        step[prop] = `$steps.${edge.source}.${sourceOut}`;
      }
    }
    return step;
  });
  const outputs = [];
  for (const node of nodes) {
    for (const out of node.data.outputs) {
      outputs.push({
        type: "JsonField",
        name: `${node.id}__${out}`,
        selector: `$steps.${node.id}.${out}`,
      });
    }
  }
  return {
    version: "1.0",
    inputs: [{ type: "WorkflowImage", name: "image" }],
    steps,
    outputs,
  };
}

const nodes = [
  {
    id: "detection",
    data: {
      blockType: "roboflow_core/roboflow_object_detection_model@v1",
      params: { model_id: "yolov8n-640" },
      outputs: ["predictions"],
    },
  },
  {
    id: "viz",
    data: {
      blockType: "roboflow_core/bounding_box_visualization@v1",
      params: {},
      outputs: ["image"],
    },
  },
];
const edges = [
  {
    source: "input:image",
    target: "detection",
    sourceHandle: "value",
    targetHandle: "images",
  },
  {
    source: "detection",
    target: "viz",
    sourceHandle: "predictions",
    targetHandle: "predictions",
  },
];

const spec = canvasToSpecification(nodes, edges);
assert.equal(spec.version, "1.0");
assert.equal(spec.steps[0].images, "$inputs.image");
assert.equal(spec.steps[1].predictions, "$steps.detection.predictions");
assert.ok(spec.outputs.length >= 1);

const here = dirname(fileURLToPath(import.meta.url));
const templatesDir = join(here, "..", "public", "templates");
const templateFiles = readdirSync(templatesDir).filter(
  (name) => name.endsWith(".json") && name !== "index.json",
);
assert.ok(templateFiles.length >= 2, "expected at least two workflow templates");
for (const name of templateFiles) {
  const doc = JSON.parse(readFileSync(join(templatesDir, name), "utf8"));
  const body = doc.specification || doc;
  assert.equal(body.version, "1.0", name);
  assert.ok(Array.isArray(body.steps) && body.steps.length >= 1, name);
}

console.log("infergraph-build check: ok");
