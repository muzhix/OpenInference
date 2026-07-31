"""End-to-end contract: Registry responses match Inference client parsers."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from inferegistry.app import create_app
from inferegistry.pack import pack_model, write_minimal_inference_config
from inference_models.weights_providers.roboflow import (
    RoboflowModelMetadata,
    parse_model_package_metadata,
)


def test_registry_weights_roundtrip_client_parsers(tmp_path: Path) -> None:
    cache_dir = tmp_path / "cache"
    source = tmp_path / "src"
    source.mkdir()
    (source / "weights.onnx").write_bytes(b"onnx")
    (source / "class_names.txt").write_text("a\n", encoding="utf-8")
    write_minimal_inference_config(source / "inference_config.json")
    pack_model(
        model_id="e2e/1",
        weights=source / "weights.onnx",
        task="object-detection",
        architecture="yolov8",
        class_names=source / "class_names.txt",
        inference_config=source / "inference_config.json",
        cache_dir=cache_dir,
    )

    client = TestClient(
        create_app(
            registry_root=cache_dir,
            public_base_url="http://127.0.0.1:8000",
        )
    )
    weights = client.get(
        "/models/v1/external/weights",
        params={"modelId": "e2e/1"},
    )
    assert weights.status_code == 200
    metadata = RoboflowModelMetadata.model_validate(weights.json()["modelMetadata"])
    assert metadata.model_packages
    package = metadata.model_packages[0]
    assert not isinstance(package, dict)
    parsed = parse_model_package_metadata(metadata=package)
    assert parsed is not None
    assert parsed.package_id == "default"

    weights_file = next(
        f for f in package.package_files if f.file_handle == "weights.onnx"
    )
    artifact = client.get(
        weights_file.download_url.replace("http://127.0.0.1:8000", "")
    )
    assert artifact.status_code == 200
    assert artifact.content == b"onnx"
