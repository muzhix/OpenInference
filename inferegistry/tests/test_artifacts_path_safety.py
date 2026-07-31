"""Artifact download path-safety tests."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from inferegistry.app import create_app
from inferegistry.pack import pack_model, write_minimal_inference_config
from inferegistry.store import encode_model_id_for_path


def _pack(cache_dir: Path) -> None:
    source = cache_dir.parent / "src"
    source.mkdir(exist_ok=True)
    weights = source / "weights.onnx"
    weights.write_bytes(b"payload-bytes")
    class_names = source / "class_names.txt"
    class_names.write_text("x\n", encoding="utf-8")
    inference_config = source / "inference_config.json"
    write_minimal_inference_config(inference_config)
    pack_model(
        model_id="safe/1",
        weights=weights,
        task="object-detection",
        architecture="yolov8",
        class_names=class_names,
        inference_config=inference_config,
        cache_dir=cache_dir,
    )


def test_artifact_download_ok(tmp_path: Path) -> None:
    cache_dir = tmp_path / "cache"
    _pack(cache_dir)
    client = TestClient(create_app(registry_root=cache_dir))
    response = client.get(
        f"/artifacts/{encode_model_id_for_path('safe/1')}/default/weights.onnx"
    )
    assert response.status_code == 200
    assert response.content == b"payload-bytes"


def test_artifact_rejects_path_traversal(tmp_path: Path) -> None:
    cache_dir = tmp_path / "cache"
    _pack(cache_dir)
    client = TestClient(create_app(registry_root=cache_dir))
    response = client.get(
        f"/artifacts/{encode_model_id_for_path('safe/1')}/default/../../../../etc/passwd"
    )
    assert response.status_code in {400, 404}
