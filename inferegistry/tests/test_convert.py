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
