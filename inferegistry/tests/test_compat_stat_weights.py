"""Compat external/stat and external/weights contract tests."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from inferegistry.app import create_app
from inferegistry.pack import pack_model, write_minimal_inference_config
from inference_models.weights_providers.roboflow import (
    RoboflowModelMetadata,
    parse_onnx_model_package,
)


def _pack_detection(cache_dir: Path, model_id: str = "my-det/1") -> None:
    source = cache_dir.parent / "src"
    source.mkdir(exist_ok=True)
    weights = source / "weights.onnx"
    weights.write_bytes(b"fake-onnx")
    class_names = source / "class_names.txt"
    class_names.write_text("a\nb\n", encoding="utf-8")
    inference_config = source / "inference_config.json"
    write_minimal_inference_config(inference_config)
    pack_model(
        model_id=model_id,
        weights=weights,
        task="object-detection",
        architecture="yolov8",
        class_names=class_names,
        inference_config=inference_config,
        cache_dir=cache_dir,
        package_id="default",
    )


def test_external_stat_and_weights_shape(tmp_path: Path) -> None:
    cache_dir = tmp_path / "cache"
    _pack_detection(cache_dir)
    app = create_app(
        registry_root=cache_dir,
        public_base_url="http://registry.test",
    )
    client = TestClient(app)

    stat = client.get("/models/v1/external/stat", params={"modelId": "my-det/1"})
    assert stat.status_code == 200
    body = stat.json()
    assert body["modelMetadata"]["modelArchitecture"] == "yolov8"
    assert body["modelMetadata"]["taskType"] == "object-detection"
    assert body["modelMetadata"]["type"] == "external-model-stat-metadata-v1"

    weights = client.get(
        "/models/v1/external/weights",
        params={"modelId": "my-det/1"},
    )
    assert weights.status_code == 200
    metadata = RoboflowModelMetadata.model_validate(weights.json()["modelMetadata"])
    assert metadata.model_id == "my-det/1"
    assert metadata.model_architecture == "yolov8"
    assert len(metadata.model_packages) == 1
    package = metadata.model_packages[0]
    assert not isinstance(package, dict)
    parsed = parse_onnx_model_package(metadata=package)
    assert parsed.package_id == "default"
    assert parsed.trusted_source is True
    assert parsed.package_artefacts
    assert any(
        f.download_url.endswith("/artifacts/my-det::1/default/weights.onnx")
        for f in package.package_files
    )


def test_external_stat_unknown_model(tmp_path: Path) -> None:
    app = create_app(registry_root=tmp_path / "cache")
    client = TestClient(app)
    response = client.get(
        "/models/v1/external/stat",
        params={"modelId": "missing/1"},
    )
    assert response.status_code == 404
