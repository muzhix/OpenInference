# inferegistry

InferGraph model Registry — local pack/import CLI and HTTP service compatible with
Roboflow `external/stat` + `external/weights` clients.

See root [`OFFLINE.md`](../OFFLINE.md).

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

uv run inferegistry register --model-id my-det/1 --cache-dir /path/to/cache

uv run inferegistry serve --host 0.0.0.0 --port 8000 \
  --registry-root /path/to/cache \
  --public-base-url http://127.0.0.1:8000
```

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
