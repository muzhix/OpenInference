from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

import inference_server.workflows.host  # noqa: F401,E402
from inference_server.workflow_studio.static import mount_workflow_studio


def _make_dist(tmp_path: Path) -> Path:
    dist_directory = tmp_path / "dist"
    dist_directory.mkdir()
    (dist_directory / "index.html").write_text("<html>studio</html>")
    (dist_directory / "assets").mkdir()
    (dist_directory / "assets" / "app.js").write_text("console.log(1)")

    return dist_directory


def test_spa_routes_fall_back_to_index_html(tmp_path, monkeypatch):
    dist_directory = _make_dist(tmp_path)
    monkeypatch.setenv("WORKFLOW_STUDIO_DIST", str(dist_directory))

    app = FastAPI()
    mounted = mount_workflow_studio(app)

    assert mounted is True
    client = TestClient(app)
    root = client.get("/studio/")
    workflow_route = client.get("/studio/workflows")
    asset = client.get("/studio/assets/app.js")
    missing_asset = client.get("/studio/assets/missing.js")

    assert root.status_code == 200
    assert workflow_route.status_code == 200
    assert "studio" in workflow_route.text
    assert asset.status_code == 200
    assert missing_asset.status_code == 200
    assert "studio" in missing_asset.text


def test_mount_skipped_when_dist_missing(tmp_path, monkeypatch):
    monkeypatch.setenv("WORKFLOW_STUDIO_DIST", str(tmp_path / "nowhere"))

    app = FastAPI()
    mounted = mount_workflow_studio(app)

    assert mounted is False
    assert not any("/studio" in path for path in client_paths(app))


def client_paths(app: FastAPI) -> list:
    paths = [getattr(route, "path", "") for route in app.routes]

    return paths
