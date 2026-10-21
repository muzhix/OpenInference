FROM roboflow/roboflow-inference-server-cpu:latest

# 修复旧版 Prometheus Instrumentator 与新版 FastAPI 的兼容性问题
RUN python -m pip install --no-cache-dir --no-deps \
    "prometheus-fastapi-instrumentator==8.1.0"