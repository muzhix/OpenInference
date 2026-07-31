"""Admin register/list/delete/validate API tests."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from inferegistry.app import create_app
from inferegistry.pack import pack_model, write_minimal_inference_config


def test_admin_crud(tmp_path: Path) -> None:
    cache_dir = tmp_path / "cache"
    source = tmp_path / "src"
    source.mkdir()
    weights = source / "weights.onnx"
    weights.write_bytes(b"w")
    class_names = source / "class_names.txt"
    class_names.write_text("c\n", encoding="utf-8")
    write_minimal_inference_config(source / "inference_config.json")
    pack_model(
        model_id="admin/1",
        weights=weights,
        task="object-detection",
        architecture="yolov8",
        class_names=class_names,
        inference_config=source / "inference_config.json",
        cache_dir=cache_dir,
    )

    client = TestClient(create_app(registry_root=cache_dir))
    listed = client.get("/v1/models")
    assert listed.status_code == 200
    assert any(m["modelId"] == "admin/1" for m in listed.json()["models"])

    validated = client.post(
        "/v1/models/validate",
        json={"modelId": "admin/1", "packageId": "default"},
    )
    assert validated.status_code == 200
    assert validated.json()["ok"] is True

    deleted = client.delete("/v1/models/admin/1")
    assert deleted.status_code == 200
    assert client.get("/v1/models").json()["models"] == []
