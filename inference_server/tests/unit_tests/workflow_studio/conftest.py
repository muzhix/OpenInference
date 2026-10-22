from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

# Install the server's WorkflowsConfiguration before any autouse fixture patches
# MODEL_CACHE_DIR: configuration installation is process-level and one-shot, so
# it must happen while the default cache dir is still in effect (same pattern
# as tests/unit_tests/workflows/test_router.py, which imports `host` first).
import inference_server.workflows.host  # noqa: F401,E402
from inference_server.workflow_studio import (
    router as workflow_studio_router,
)  # noqa: E402


@pytest.fixture
def studio_db_path(tmp_path: Path, monkeypatch) -> Path:
    db_path = tmp_path / "workflow_studio.db"
    monkeypatch.setenv("WORKFLOW_STUDIO_DB", str(db_path))

    return db_path


@pytest.fixture
def studio_client(studio_db_path) -> TestClient:
    app = FastAPI()
    app.include_router(workflow_studio_router.router)
    client = TestClient(app)

    return client
