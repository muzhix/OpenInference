"""Pack writes a models-cache package discoverable without Roboflow HTTP."""

from __future__ import annotations

import json
from pathlib import Path
from unittest import mock

import pytest

from inferegistry.pack import pack_model, write_minimal_inference_config


@pytest.fixture
def staged_detection_inputs(tmp_path: Path) -> dict[str, Path]:
    weights = tmp_path / "source" / "weights.onnx"
    weights.parent.mkdir(parents=True)
    weights.write_bytes(b"fake-onnx-bytes-for-pack-test")

    class_names = tmp_path / "source" / "class_names.txt"
    class_names.write_text("cat\ndog\n", encoding="utf-8")

    inference_config = tmp_path / "source" / "inference_config.json"
    write_minimal_inference_config(inference_config)

    return {
        "weights": weights,
        "class_names": class_names,
        "inference_config": inference_config,
        "cache_dir": tmp_path / "cache",
    }


def test_pack_model_is_discoverable_via_inference_models_cache(
    staged_detection_inputs: dict[str, Path],
) -> None:
    model_id = "my-det/1"
    cache_dir = staged_detection_inputs["cache_dir"]

    package_dir = pack_model(
        model_id=model_id,
        weights=staged_detection_inputs["weights"],
        task="object-detection",
        architecture="yolov8",
        class_names=staged_detection_inputs["class_names"],
        inference_config=staged_detection_inputs["inference_config"],
        cache_dir=cache_dir,
        package_id="default",
    )

    assert package_dir.is_dir()
    config_path = package_dir / "model_config.json"
    assert config_path.is_file()
    assert (package_dir / "weights.onnx").is_file()
    assert (package_dir / "class_names.txt").is_file()
    assert (package_dir / "inference_config.json").is_file()

    config = json.loads(config_path.read_text(encoding="utf-8"))
    assert config["model_id"] == model_id
    assert config["canonical_model_id"] == model_id
    assert config["task_type"] == "object-detection"
    assert config["model_architecture"] == "yolov8"
    assert config["backend_type"] == "onnx"
    assert config["trusted_source"] is True
    assert config["offline_manifest_version"] == 4
    assert config["package_artifacts"]
    # Portable cold packs leave runtime hash unset (use pin_runtime=True to pin).
    assert config.get("runtime_compatibility_hash") in (None, "")
    assert config.get("offline_compatibility_hash") in (None, "")

    from inference_models.models.auto_loaders.core import (
        find_cached_model_package_dir,
        parse_model_config,
    )

    found = find_cached_model_package_dir(model_id=model_id, api_key=None)
    assert found is not None
    assert Path(found).resolve() == package_dir.resolve()

    parsed = parse_model_config(config_path=str(config_path))
    assert parsed.task_type == "object-detection"
    assert parsed.model_architecture == "yolov8"


def test_pack_pin_runtime_embeds_hash(
    staged_detection_inputs: dict[str, Path],
) -> None:
    package_dir = pack_model(
        model_id="pinned/1",
        weights=staged_detection_inputs["weights"],
        task="object-detection",
        architecture="yolov8",
        class_names=staged_detection_inputs["class_names"],
        inference_config=staged_detection_inputs["inference_config"],
        cache_dir=staged_detection_inputs["cache_dir"],
        pin_runtime=True,
    )
    config = json.loads((package_dir / "model_config.json").read_text(encoding="utf-8"))
    assert isinstance(config.get("runtime_compatibility_hash"), str)
    assert len(config["runtime_compatibility_hash"]) == 64


def test_pack_metadata_matches_get_model_type_models_cache_branch(
    staged_detection_inputs: dict[str, Path],
) -> None:
    """Mirror registries.roboflow._get_model_metadata_from_inference_models_cache.

    Full ``get_model_type`` needs the inference package installed; this asserts
    the same models-cache discovery + (task, architecture) mapping with no HTTP.
    """
    from inference_models.models.auto_loaders.core import find_cached_model_package_dir
    from inference_models.utils.file_system import read_json

    model_id = "my-det/1"
    cache_dir = staged_detection_inputs["cache_dir"]

    pack_model(
        model_id=model_id,
        weights=staged_detection_inputs["weights"],
        task="object-detection",
        architecture="yolov8",
        class_names=staged_detection_inputs["class_names"],
        inference_config=staged_detection_inputs["inference_config"],
        cache_dir=cache_dir,
        package_id="default",
    )

    with mock.patch("requests.sessions.Session.request") as request_mock:
        cached_dir = find_cached_model_package_dir(model_id=model_id, api_key=None)
        assert cached_dir is not None
        metadata = read_json(path=str(Path(cached_dir) / "model_config.json"))
        result = (metadata["task_type"], metadata["model_architecture"])

    assert result == ("object-detection", "yolov8")
    request_mock.assert_not_called()


def test_pack_then_get_model_type_without_http_when_inference_installed(
    staged_detection_inputs: dict[str, Path],
) -> None:
    pytest.importorskip("inference.core.registries.roboflow")

    from inference.core.registries import roboflow
    from inference.core.registries.roboflow import get_model_type

    model_id = "my-det/1"
    cache_dir = staged_detection_inputs["cache_dir"]

    pack_model(
        model_id=model_id,
        weights=staged_detection_inputs["weights"],
        task="object-detection",
        architecture="yolov8",
        class_names=staged_detection_inputs["class_names"],
        inference_config=staged_detection_inputs["inference_config"],
        cache_dir=cache_dir,
        package_id="default",
    )

    with mock.patch.object(roboflow, "OFFLINE_MODE", True), mock.patch.object(
        roboflow, "USE_INFERENCE_MODELS", True
    ), mock.patch.object(
        roboflow, "get_model_metadata_from_inference_models_registry"
    ) as registry_api_mock, mock.patch.object(
        roboflow, "get_roboflow_model_data"
    ) as model_api_mock, mock.patch.object(
        roboflow, "get_roboflow_instant_model_data"
    ) as instant_api_mock, mock.patch(
        "inference.core.roboflow_api._get_from_url"
    ) as get_from_url_mock:
        result = get_model_type(model_id=model_id, api_key=None)

    assert result == ("object-detection", "yolov8")
    registry_api_mock.assert_not_called()
    model_api_mock.assert_not_called()
    instant_api_mock.assert_not_called()
    get_from_url_mock.assert_not_called()