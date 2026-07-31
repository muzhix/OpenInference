"""Resolve InferGraph cache roots and keep inference-models path helpers in sync."""

from __future__ import annotations

import os
from pathlib import Path

import inference_models.configuration as im_configuration
import inference_models.models.auto_loaders.model_cache_paths as model_cache_paths


def resolve_cache_dir(cache_dir: str | None = None) -> Path:
    """Return the absolute model cache root.

    Args:
        cache_dir: Explicit cache directory. When omitted, use ``INFERENCE_HOME``
            or ``MODEL_CACHE_DIR``, falling back to ``/tmp/cache``.

    Returns:
        Absolute path to the cache root.
    """
    if cache_dir:
        resolved = Path(cache_dir).expanduser().resolve()
    else:
        raw = (
            os.getenv("INFERENCE_HOME")
            or os.getenv("MODEL_CACHE_DIR")
            or "/tmp/cache"
        )
        resolved = Path(raw).expanduser().resolve()

    return resolved


def apply_cache_dir(cache_dir: str | Path) -> Path:
    """Set process cache env and mirror it into inference-models modules.

    ``INFERENCE_HOME`` is imported into ``model_cache_paths`` at module load
    time, so env updates alone are not enough for callers that already imported
    inference-models.

    Args:
        cache_dir: Cache root to use for subsequent pack/import writes.

    Returns:
        Absolute cache root path.
    """
    resolved = Path(cache_dir).expanduser().resolve()
    resolved_str = str(resolved)
    os.environ["INFERENCE_HOME"] = resolved_str
    os.environ["MODEL_CACHE_DIR"] = resolved_str
    im_configuration.INFERENCE_HOME = resolved_str
    model_cache_paths.INFERENCE_HOME = resolved_str

    return resolved
