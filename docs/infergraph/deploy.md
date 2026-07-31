# InferGraph deploy

Offline Inference + Registry with InferGraph Build enabled.

## Quick start

```bash
# From repo root
set -a && source env.infergraph && set +a
# ENABLE_BUILDER=True, BUILDER_ORIGIN=http://127.0.0.1:9001
# OFFLINE_MODE=True, API_* → local Registry
```

Docker:

```bash
docker compose -f docker/compose.infergraph-cloudless.yml up --build
```

Open:

- Inference: `http://127.0.0.1:9001`
- Build: `http://127.0.0.1:9001/build`
- Registry health: `http://127.0.0.1:8000/healthz`

See also root [`OFFLINE.md`](../../OFFLINE.md) for the 30-minute path.

## Profile knobs

| Variable | Role |
| --- | --- |
| `OFFLINE_MODE` | No Roboflow cloud fallback |
| `INFERGRAPH_REGISTRY_ALLOWLIST` | Hosts allowed while offline |
| `ENABLE_BUILDER` | Mount `/build` + InferGraph Build SPA |
| `BUILDER_ORIGIN` | Origin of Build SPA (same-origin for cloudless) |
| `WORKFLOW_DISABLED_BLOCK_PATTERNS` | Disable cloud sink blocks |

Dev Build against Vite: set `BUILDER_ORIGIN=http://127.0.0.1:5173` and run `cd infergraph-build && npm run dev`.
