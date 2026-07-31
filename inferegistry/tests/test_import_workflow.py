"""Tests for import-workflow."""

from __future__ import annotations

import json
from hashlib import sha256
from pathlib import Path

import pytest

from inferegistry.import_workflow import import_workflow


def test_import_workflow_writes_hashed_local_file(tmp_path: Path) -> None:
    source = tmp_path / "wf.json"
    source.write_text(
        json.dumps(
            {
                "version": "1.0.0",
                "inputs": [],
                "steps": [],
                "outputs": [],
            }
        ),
        encoding="utf-8",
    )
    cache_dir = tmp_path / "cache"
    workflow_id = "demo-flow"

    path = import_workflow(
        workflow_id=workflow_id,
        source=source,
        cache_dir=cache_dir,
    )

    expected = (
        cache_dir
        / "workflow"
        / "local"
        / f"{sha256(workflow_id.encode()).hexdigest()}.json"
    )
    assert path == expected.resolve()
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert payload["id"] == workflow_id
    assert payload["version"] == "1.0.0"


def test_import_workflow_rejects_reserved_id(tmp_path: Path) -> None:
    source = tmp_path / "wf.json"
    source.write_text("{}", encoding="utf-8")
    with pytest.raises(ValueError, match="reserved"):
        import_workflow(workflow_id="models", source=source, cache_dir=tmp_path)
