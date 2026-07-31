# InferGraph Registry

HTTP service compatible with Inference `external/stat` + `external/weights` clients.

## Serve

```bash
cd inferegistry
uv run inferegistry serve \
  --host 127.0.0.1 --port 8000 \
  --registry-root ../infergraph-cache \
  --public-base-url http://127.0.0.1:8000
```

Point Inference at the Registry (`env.infergraph`):

```bash
API_BASE_URL=http://127.0.0.1:8000
ROBOFLOW_API_HOST=http://127.0.0.1:8000
INFERGRAPH_API_HOST=http://127.0.0.1:8000
INFERGRAPH_REGISTRY_ALLOWLIST=127.0.0.1:8000
OFFLINE_MODE=True
```

## Admin token (optional)

Set `INFERGRAPH_REGISTRY_TOKEN` to require `Authorization: Bearer <token>` on Registry admin mutate routes (`POST`/`DELETE` `/v1/models`). Read/compat endpoints used by Inference stay usable on a trusted network without a token. This is a shared secret for LAN hardening — not SaaS multi-tenant auth.

## Endpoints

| Method | Path | Role |
| --- | --- | --- |
| GET | `/models/v1/external/stat` | Compat metadata |
| GET | `/models/v1/external/weights` | Compat packages + URLs |
| GET | `/artifacts/...` | Artifact bytes |
| GET/POST/DELETE | `/v1/models` | Admin |
| GET | `/healthz` | Health |
