# InferGraph Build

Offline-first visual Workflow editor (React + React Flow) for InferGraph.

Embeds in the Inference `/build` iframe shell (`serverUrl` + `csrf` query params).

## Develop

```bash
# Terminal A: Inference with ENABLE_BUILDER=True (see env.infergraph)
# Terminal B:
cd infergraph-build
npm install
npm run dev
# Point BUILDER_ORIGIN=http://127.0.0.1:5173 or open
# http://127.0.0.1:5173/workflows/local?serverUrl=http://127.0.0.1:9001&csrf=<token>
```

## Build / ship

```bash
npm run build
# Outputs dist/ — served by Inference at GET /workflows/local when ENABLE_BUILDER
```

## Check

```bash
npm run check
```
