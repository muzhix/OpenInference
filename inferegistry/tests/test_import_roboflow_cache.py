"""Tests for import-roboflow-cache."""

from __future__ import annotations

import json
from pathlib import Path

from inferegistry.import_cache import import_roboflow_cache
from inferegistry.pack import pack_model, write_minimal_inference_config


def test_import_traditional_cache(tmp_path: Path) -> None:
    source = tmp_path / "warm"
    package = source / "demo-project" / "3"
    package.mkdir(parents=True)
    (package / "model_type.json").write_text(
        json.dumps(
            {
                "project_task_type": "object-detection",
                "model_type": "yolov8n",
                "model_id": "demo-project/3",
            }
        ),
        encoding="utf-8",
    )
    (package / "weights.onnx").write_bytes(b"traditional-weights")

    cache_dir = tmp_path / "cache"
    result = import_roboflow_cache(source=source, cache_dir=cache_dir)

    assert result["traditional"] == ["demo-project/3"]
    imported = cache_dir / "demo-project" / "3" / "model_type.json"
    assert imported.is_file()
    metadata = json.loads(imported.read_text(encoding="utf-8"))
    assert metadata["model_type"] == "yolov8n"


def test_import_models_cache_subtree(tmp_path: Path) -> None:
    source_cache = tmp_path / "source-cache"
    weights = tmp_path / "weights.onnx"
    weights.write_bytes(b"pack-then-import")
    class_names = tmp_path / "class_names.txt"
    class_names.write_text("a\n", encoding="utf-8")
    inference_config = tmp_path / "inference_config.json"
    write_minimal_inference_config(inference_config)

    pack_model(
        model_id="imported-det/1",
        weights=weights,
        task="object-detection",
        architecture="yolov8",
        class_names=class_names,
        inference_config=inference_config,
        cache_dir=source_cache,
        package_id="default",
    )

    dest_cache = tmp_path / "dest-cache"
    result = import_roboflow_cache(source=source_cache, cache_dir=dest_cache)

    assert result["models_cache"]
    assert any("models-cache" in path for path in result["models_cache"])
    configs = list((dest_cache / "models-cache").rglob("model_config.json"))
    assert len(configs) == 1
    config = json.loads(configs[0].read_text(encoding="utf-8"))
    assert config["model_id"] == "imported-det/1"
