# InferGraph 无云离线推理（P0 + P1）

断网 + 无 Roboflow 账号时，用本地 cache 与 **InferGraph Registry** 跑推理。底层开关仍是 `OFFLINE_MODE`；P1 允许访问 allowlist 内的自建 Registry，**永不**回落 `*.roboflow.com`。

自定义 Workflow Block / 用户代码若自行联网，不在本约束内。硬 air-gap 需 OS 层隔离。

## InferGraph 模型包（只教这一种）

```text
$MODEL_CACHE_DIR/models-cache/{slug}/{package_id}/
├── model_config.json
├── weights.onnx|pt|engine
├── class_names.txt
└── inference_config.json
```

另有 `index.json`（Registry 索引，由 `pack` / `register` 维护）。

## 四步走

### 1. Pack（并注册到 index）

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

导入官方 cache / workflow：

```bash
uv run inferegistry import-roboflow-cache --source /path/to/warm --cache-dir ../infergraph-cache
uv run inferegistry import-workflow --workflow-id demo --source ./workflow.json --cache-dir ../infergraph-cache
```

### 2. 启动 InferGraph Registry

```bash
uv run inferegistry serve \
  --host 127.0.0.1 --port 8000 \
  --registry-root ../infergraph-cache \
  --public-base-url http://127.0.0.1:8000
```

Compat 端点：

- `GET /models/v1/external/stat?modelId=`
- `GET /models/v1/external/weights?modelId=`
- `GET /artifacts/{modelIdEncoded}/{packageId}/{fileHandle}`

### 3. 无云启动 Inference（指向 Registry）

```bash
set -a && source ../env.infergraph && set +a
# 关键：
#   OFFLINE_MODE=True
#   API_BASE_URL=ROBOFLOW_API_HOST=http://127.0.0.1:8000
#   INFERGRAPH_REGISTRY_ALLOWLIST=127.0.0.1:8000
```

Docker：

```bash
docker compose -f docker/compose.infergraph-cloudless.yml up
```

### 4. 推理（无 API key，base64 图）

```bash
curl -s http://127.0.0.1:9001/infer/object_detection \
  -H 'Content-Type: application/json' \
  -d '{"model_id":"my-det/1","image":{"type":"base64","value":"<...>"}}'
```

Cache miss 时会查询 allowlist 内的 Registry；仍不会请求 Roboflow 云。

## 自检

```bash
cd inferegistry && uv sync --extra dev && uv run pytest -q
```

相关测试：

- `inferegistry/tests/test_compat_stat_weights.py`
- `inferegistry/tests/test_artifacts_path_safety.py`
- `inferegistry/tests/test_e2e_registry_client_shape.py`
- `tests/inference/unit_tests/core/test_infergraph_cloudless_guards.py`
- `inference_models/tests/unit_tests/test_registry_allowlist.py`

## 非目标

- InferGraph Build 前端（P3）
- 全局去掉 `ROBOFLOW_*` 命名（P2）
- legacy `/ort` / `getWeights`
- 使用或分发 `inference/enterprise/`
