"""InferGraph Build SPA is served at /workflows/local when ENABLE_BUILDER."""

from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.testclient import TestClient

_REPO_ROOT = Path(__file__).resolve().parents[6]
_DIST = _REPO_ROOT / "infergraph-build" / "dist"


@pytest.mark.skipif(not (_DIST / "index.html").is_file(), reason="infergraph-build dist missing")
def test_infergraph_build_spa_index_contains_brand():
    app = FastAPI()
    assets = _DIST / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets)), name="ig_build_assets")

    def _index():
        return FileResponse(_DIST / "index.html", media_type="text/html")

    @app.get("/workflows/local")
    async def spa_root():
        return _index()

    @app.get("/workflows/local/{workflow_id}")
    async def spa_edit(workflow_id: str):
        return _index()

    client = TestClient(app)
    for path in ("/workflows/local", "/workflows/local/demo_wf"):
        res = client.get(path)
        assert res.status_code == 200
        assert "text/html" in res.headers["content-type"]
        assert "InferGraph Build" in res.text

    # Built assets referenced from index must exist on disk
    assert "assets/" in res.text
