"""ASGI application for InferGraph Registry HTTP service."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI

from inferegistry.api import compat, models
from inferegistry.store import RegistryStore


def create_app(
    *,
    registry_root: str | Path | None = None,
    public_base_url: str | None = None,
) -> FastAPI:
    """Build the InferGraph Registry FastAPI app.

    Args:
        registry_root: Cache/registry root (models-cache + index.json).
        public_base_url: Absolute base used in package downloadUrl fields.

    Returns:
        Configured FastAPI application.
    """
    root = (
        registry_root
        or os.getenv("INFERGRAPH_REGISTRY_ROOT")
        or os.getenv("INFERENCE_HOME")
        or os.getenv("MODEL_CACHE_DIR")
        or "/tmp/cache"
    )
    public_base = (
        public_base_url
        or os.getenv("INFERGRAPH_REGISTRY_PUBLIC_BASE_URL")
        or "http://127.0.0.1:8000"
    )
    app = FastAPI(title="InferGraph Registry", version="0.1.0")
    app.state.store = RegistryStore(root, public_base_url=public_base)
    app.include_router(compat.router)
    app.include_router(models.router)

    @app.get("/healthz")
    def healthz() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
