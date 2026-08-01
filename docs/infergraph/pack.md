# InferGraph pack & convert

Build an InferGraph `models-cache` package for offline inference.

## Pack (preferred)

```bash
cd inferegistry
uv sync --extra dev

uv run inferegistry pack \
  --model-id my-det/1 \
  --weights ./weights.onnx \
  --task object-detection \
  --architecture yolov8 \
  --class-names ./class_names.txt \
  --inference-config ./inference_config.json \
  --cache-dir ../infergraph-cache
```

Writes `$CACHE/models-cache/...` and upserts `index.json`.

### Runtime pinning

By default InferGraph **cold packs leave `runtime_compatibility_hash` unset**, so the
same ONNX package loads under `OFFLINE_MODE` on other hosts (different torch/CUDA/ORT).

Use `--pin-runtime` only when the weights are environment-specific (TensorRT `.engine`,
custom CUDA builds). A pinned package is **skipped** on mismatch — pack again on the
target machine, or omit the pin.

```bash
uv run inferegistry pack ... --pin-runtime
```

`convert` uses the same default (portable). Both still leave `offline_compatibility_hash`
unset; that hash is only meaningful after a warm load.

## Convert traditional cache

If you already have a warm Roboflow **traditional** package (`model_type.json` + weights):

```bash
uv run inferegistry convert \
  --source /path/to/warm-or-package \
  --model-id demo-project/3 \
  --cache-dir ../infergraph-cache
```

Optional: `--task`, `--architecture`, `--package-id`.

**Boundaries:** one package at a time when multiple exist (pass `--model-id`). Missing class names default to a stub `object` class and a minimal `inference_config.json`. Exotic historical cache layouts may still need a manual `pack`. See also `import-roboflow-cache` for copying trees as-is.
