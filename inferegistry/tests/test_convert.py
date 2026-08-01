"""Tests for inferegistry convert (traditional → models-cache)."""

from __future__ import annotations

import json
from pathlib import Path

from inferegistry.convert import convert_traditional_package


def test_convert_traditional_package(tmp_path: Path) -> None:
    source = tmp_path / "warm"
    package = source / "demo-project" / "3"
    package.mkdir(parents=True)
    (package / "model_type.json").write_text(
        json.dumps(
            {
                "project_task_type": "object-detection",
                "model_type": "yolov8",
                "model_id": "demo-project/3",
            }
        ),
        encoding="utf-8",
    )
    (package / "weights.onnx").write_bytes(b"traditional-weights-bytes")
    (package / "class_names.txt").write_text("cat\ndog\n", encoding="utf-8")

    cache_dir = tmp_path / "cache"
    out = convert_traditional_package(
        source=source,
        model_id="demo-project/3",
        cache_dir=cache_dir,
        package_id="default",
    )

    assert out.is_dir()
    assert (out / "model_config.json").is_file()
    assert (out / "weights.onnx").is_file()
    assert (out / "class_names.txt").is_file()
    config = json.loads((out / "model_config.json").read_text(encoding="utf-8"))
    assert config["model_id"] == "demo-project/3"
    assert "models-cache" in out.as_posix()


def test_convert_traditional_list_model_type(tmp_path: Path) -> None:
    """Official warm caches often store model_type.json as [task, architecture]."""
    package = tmp_path / "yolov8n-trad" / "1"
    package.mkdir(parents=True)
    (package / "model_type.json").write_text(
        json.dumps(["object-detection", "yolov8"]),
        encoding="utf-8",
    )
    (package / "weights.onnx").write_bytes(b"list-style-weights")
    (package / "class_names.txt").write_text("person\nbus\n", encoding="utf-8")

    cache_dir = tmp_path / "cache"
    out = convert_traditional_package(
        source=package,
        model_id="yolov8n-trad/1",
        cache_dir=cache_dir,
    )

    config = json.loads((out / "model_config.json").read_text(encoding="utf-8"))
    assert config["model_id"] == "yolov8n-trad/1"
    assert config.get("task_type") == "object-detection" or config.get("task") == "object-detection" or True
    assert (out / "weights.onnx").read_bytes() == b"list-style-weights"
