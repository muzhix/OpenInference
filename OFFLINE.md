# InferGraph 无云离线推理（P0）

断网 + 无 Roboflow 账号时，用本地 cache 跑推理。底层开关仍是上游的 `OFFLINE_MODE`；InferGraph 通过发行 profile 与 `inferegistry` 工具把它变成默认工作流。

自定义 Workflow Block / 用户代码若自行联网，不在本约束内。硬 air-gap 需 OS 层隔离（防火墙 / 无路由）。

## InferGraph 模型包（只教这一种）

新写入一律使用 **inference-models** 布局：

```text
$MODEL_CACHE_DIR/models-cache/{slug}/{package_id}/
├── model_config.json       # offline manifest v4
├── weights.onnx|pt|engine
├── class_names.txt
└── inference_config.json   # 检测等任务建议提供
```

官方 Roboflow traditional cache（`model_type.json`）仍可读；用 `import-roboflow-cache` 导入，P0 **不做** traditional→models-cache 转换。

## 三步走

### 1. Pack 模型

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

或导入已有 cache：

```bash
uv run inferegistry import-roboflow-cache \
  --source /path/to/warm-cache \
  --cache-dir ../infergraph-cache

uv run inferegistry import-workflow \
  --workflow-id demo \
  --source ./workflow.json \
  --cache-dir ../infergraph-cache
```

### 2. 无云启动

```bash
set -a && source ../env.infergraph && set +a
# 或 Docker：
# docker compose -f docker/compose.infergraph-cloudless.yml up
```

关键变量：`OFFLINE_MODE=True`，`API_BASE_URL` / `ROBOFLOW_API_HOST` 指向不可达占位（`127.0.0.1:9`），`MODEL_CACHE_DIR` / `INFERENCE_HOME` 指向同一 cache。

### 3. 推理（无 API key，base64 图）

```bash
curl -s http://127.0.0.1:9001/infer/object_detection \
  -H 'Content-Type: application/json' \
  -d '{"model_id":"my-det/1","image":{"type":"base64","value":"<...>"}}'
```

Cache miss 时会提示使用 `inferegistry pack` / `import-roboflow-cache`，不会回落 Roboflow 云。

## 自检

```bash
cd inferegistry && uv sync --extra dev && uv run pytest -q
```

相关守卫单测：

- `inferegistry/tests/test_pack_offline_metadata.py`
- `tests/inference/unit_tests/core/test_infergraph_cloudless_guards.py`
- 既有：`test_offline_mode_configuration.py`、`test_offline_remote_execution.py`、URL 读图 offline 测

## 非目标（P0）

- HTTP Registry（P1）
- InferGraph Build 前端（P3）
- 全局去掉 `ROBOFLOW_*` 命名（P2）
- 使用或分发 `inference/enterprise/`
