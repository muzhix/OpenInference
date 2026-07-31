# inferegistry

InferGraph local model/workflow cache tooling.

| Phase | Scope |
| --- | --- |
| **P0** | CLI: `pack`, `import-roboflow-cache`, `import-workflow` |
| **P1** | HTTP Registry replacing `api.roboflow.com` |

See also root [`OFFLINE.md`](../OFFLINE.md).

## Setup

```bash
cd inferegistry
uv sync --extra dev
```

## Commands

### pack

Write an inference-models package under `$cache/models-cache/...`:

```bash
uv run inferegistry pack \
  --model-id my-det/1 \
  --weights ./weights.onnx \
  --task object-detection \
  --architecture yolov8 \
  --class-names ./class_names.txt \
  --inference-config ./inference_config.json \
  --cache-dir /path/to/cache
```

### import-roboflow-cache

Copy traditional (`model_type.json`) and/or `models-cache` packages into a local cache:

```bash
uv run inferegistry import-roboflow-cache \
  --source /path/to/warm-or-export \
  --cache-dir /path/to/cache
```

### import-workflow

Write workflow JSON to `{cache}/workflow/local/{sha256(id)}.json` (same layout as `/build/api`):

```bash
uv run inferegistry import-workflow \
  --workflow-id demo \
  --source ./workflow.json \
  --cache-dir /path/to/cache
```

## Tests

```bash
uv run pytest -q
```
