#!/usr/bin/env python3
"""Start InferGraph HTTP server for local e2e (stubs optional HF models not needed for YOLOv8)."""

from __future__ import annotations

import os
import sys
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT), str(ROOT / "inference_models")]

os.environ.setdefault("HF_HUB_CACHE", "/tmp/hf-hub")
os.environ.setdefault("CORE_MODEL_GAZE_ENABLED", "False")
os.environ.setdefault("QWEN_2_5_ENABLED", "False")
os.environ.setdefault("QWEN_3_ENABLED", "False")
os.environ.setdefault("CORE_MODEL_SAM_ENABLED", "False")
os.environ.setdefault("CORE_MODEL_SAM2_ENABLED", "False")
os.environ.setdefault("CORE_MODEL_SAM3_ENABLED", "False")
os.environ.setdefault("CORE_MODEL_CLIP_ENABLED", "False")
os.environ.setdefault("CORE_MODEL_GROUNDINGDINO_ENABLED", "False")
os.environ.setdefault("CORE_MODEL_YOLO_WORLD_ENABLED", "False")
os.environ.setdefault("DEPTH_ESTIMATION_ENABLED", "False")
os.environ.setdefault("CORE_MODEL_PE_ENABLED", "False")


def _stub(name: str, **attrs: object) -> None:
    mod = types.ModuleType(name)
    for key, value in attrs.items():
        setattr(mod, key, value)
    sys.modules[name] = mod


class _Dummy:
    pass


# Optional multimodal stacks not required for packed YOLOv8 OD e2e.
_stub("inference_models.models.qwen3_5")
_stub("inference_models.models.qwen3_5.qwen3_5_hf", Qwen35HF=_Dummy)
_stub(
    "inference.models.qwen3_5vl.qwen3_5vl_inference_models",
    InferenceModelsQwen35VLAdapter=_Dummy,
    Qwen35VL=_Dummy,
)

import uvicorn

from docker.config.cpu_http import app

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "9001")))
