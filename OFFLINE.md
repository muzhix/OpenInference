# InferGraph 无云离线推理（P0 + P1 + P2）

断网 + 无 Roboflow 账号时，用本地 cache 与 **InferGraph Registry** 跑推理。底层开关仍是 `OFFLINE_MODE`；P1 允许访问 allowlist 内的自建 Registry，**永不**回落 `*.roboflow.com`。

自定义 Workflow Block / 用户代码若自行联网，不在本约束内。硬 air-gap 需 OS 层隔离。

## 品牌与环境变量别名（P2）

产品名：**InferGraph**（OpenAPI / `/info` / Landing）。协议字段与部分内部模块名仍可能出现 `roboflow_*`（Roboflow-compatible）。

| 用途 | 推荐 | 兼容旧名 |
| --- | --- | --- |
| API key | `INFERGRAPH_API_KEY` | `ROBOFLOW_API_KEY`, `API_KEY` |
| Registry / API host | `INFERGRAPH_API_HOST` | `ROBOFLOW_API_HOST` |
| Extra headers | `INFERGRAPH_API_EXTRA_HEADERS` | `ROBOFLOW_API_EXTRA_HEADERS` |
| Request timeout / SSL | `INFERGRAPH_API_REQUEST_TIMEOUT` / `INFERGRAPH_API_VERIFY_SSL` | 对应 `ROBOFLOW_*` |
| Service secret | `INFERGRAPH_SERVICE_SECRET` | `ROBOFLOW_SERVICE_SECRET` |

新名优先；未设置时回落旧名。`env.infergraph` 已注释推荐写法。

### 默认禁用的云 sink blocks

InferGraph profile 通过 `WORKFLOW_DISABLED_BLOCK_PATTERNS` 禁用直连 Roboflow 云的 sink（不删源码）：

`roboflow.dataset_upload`, `model_monitoring_inference_aggregator`, `roboflow.custom_metadata`, `roboflow.vision_events`, `asset_library_attributes`, `visual_search`

（pattern 匹配 class / module / friendly name 子串；用模块路径片段才能盖住 `roboflow_dataset_upload` 等 type Literal。）

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
- `tests/inference/unit_tests/core/test_infergraph_env_aliases.py`
- `tests/workflows/unit_tests/core_steps/test_infergraph_disabled_sinks.py`
- `inference_models/tests/unit_tests/test_registry_allowlist.py`

## 非目标

- InferGraph Build 前端（P3）
- 全局改代码默认 `API_BASE_URL` / 重命名 `roboflow_*.py` 模块
- 删除云 sink 源码；mkdocs CDN 全量清理（P4）
- legacy `/ort` / `getWeights`
- 使用或分发 `inference/enterprise/`
