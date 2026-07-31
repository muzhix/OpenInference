# InferGraph Workflow templates

Local (non-cloud) example Workflows for InferGraph Build.

| File | Purpose |
| --- | --- |
| `detect_and_visualize.json` | Object detection + bounding-box visualization |
| `classify_image.json` | Single classification model step |

## Import

In InferGraph Build: **Templates** dropdown, or **Import** a file.

Accepted shapes:

- InferGraph package: `{ id, name, specification, ui? }`
- Bare Roboflow-compatible specification: `{ version, inputs, steps, outputs }`

Replace `model_id` defaults with a model present in your local cache / Registry.

Also mirrored under `infergraph-build/public/templates/` for the SPA.
