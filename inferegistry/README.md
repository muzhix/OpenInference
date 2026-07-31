# inferegistry

**InferGraph** model Registry — local pack/import CLI and HTTP service for the
InferGraph offline runtime. Compatible with Roboflow `external/stat` +
`external/weights` clients.

See root [`OFFLINE.md`](../OFFLINE.md) for brand aliases (`INFERGRAPH_*`) and
cloudless setup.

## Setup

```bash
cd inferegistry
uv sync --extra dev
```

## CLI

```bash
# Pack + register into index.json
uv run inferegistry pack --model-id my-det/1 --weights ./weights.onnx \
  --task object-detection --architecture yolov8 \
  --class-names ./class_names.txt --cache-dir /path/to/cache

# Convert traditional cache package → models-cache
uv run inferegistry convert --source /path/to/warm --model-id demo/1 \
  --cache-dir /path/to/cache

uv run inferegistry register --model-id my-det/1 --cache-dir /path/to/cache

uv run inferegistry serve --host 0.0.0.0 --port 8000 \
  --registry-root /path/to/cache \
  --public-base-url http://127.0.0.1:8000
```

Docs: [`docs/infergraph/pack.md`](../docs/infergraph/pack.md), [`docs/infergraph/registry.md`](../docs/infergraph/registry.md).

## HTTP

| Method | Path | Role |
| --- | --- | --- |
| GET | `/models/v1/external/stat` | Compat metadata |
| GET | `/models/v1/external/weights` | Compat packages + download URLs |
| GET | `/artifacts/{modelId}/{packageId}/{file}` | Artifact bytes |
| GET/POST/DELETE | `/v1/models` | Admin list/register/delete |
| GET | `/healthz` | Health |

## Tests

```bash
uv run pytest -q
```
