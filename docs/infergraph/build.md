# InferGraph Build

Open-source visual Workflow editor (React + React Flow) embedded in `/build`.

## Open

With `ENABLE_BUILDER=True` and a built `infergraph-build/dist/`:

```text
http://127.0.0.1:9001/build
```

The iframe loads same-origin `/workflows/local?serverUrl=…&csrf=…` — no `app.roboflow.com`.

## Templates

Use **Templates…** for local examples (also under `examples/infergraph-workflows/`):

- Detect and visualize
- Classify image

Replace default `model_id` values with models in your cache.

## Import / export

| Action | Shape |
| --- | --- |
| **Export** | InferGraph package `{ id, name, specification, ui }` |
| **Export spec** | Bare `{ version, inputs, steps, outputs }` |
| **Import** | Either of the above |

Complex block fields use a JSON textarea. Dynamic outputs / Universe templates are out of scope.

## Develop

```bash
cd infergraph-build
npm install && npm run dev
# BUILDER_ORIGIN=http://127.0.0.1:5173
npm run build && npm run check
```
