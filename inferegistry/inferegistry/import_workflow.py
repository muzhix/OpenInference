"""Import workflow JSON into the local builder storage layout."""

from __future__ import annotations

import json
import os
import re
import tempfile
from hashlib import sha256
from pathlib import Path
from typing import Any

from inferegistry._paths import resolve_cache_dir

_WORKFLOW_ID_RE = re.compile(r"^[\w\-]+$")
_RESERVED_WORKFLOW_IDS = {"models", "api"}


def import_workflow(
    *,
    workflow_id: str,
    source: str | Path,
    cache_dir: str | Path | None = None,
) -> Path:
    """Import a workflow JSON into ``{cache}/workflow/local/{sha256(id)}.json``.

    Matches the on-disk convention used by
    ``inference.core.interfaces.http.builder.routes``.

    Args:
        workflow_id: Local workflow identifier (``^[\\w\\-]+$``).
        source: Path to a workflow JSON file.
        cache_dir: Cache root containing ``workflow/local/``.

    Returns:
        Absolute path to the written workflow JSON file.
    """
    if not _WORKFLOW_ID_RE.fullmatch(workflow_id):
        raise ValueError(
            f"Invalid workflow_id `{workflow_id}`; expected pattern ^[\\w\\-]+$"
        )
    if workflow_id in _RESERVED_WORKFLOW_IDS:
        raise ValueError(f"`{workflow_id}` is a reserved workflow identifier")

    source_path = Path(source).expanduser().resolve()
    if source_path.is_symlink() or not source_path.is_file():
        raise ValueError(f"Source must be a regular JSON file: {source_path}")

    payload: Any = json.loads(source_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Workflow JSON must be an object")

    payload = dict(payload)
    payload["id"] = workflow_id

    cache_root = resolve_cache_dir(str(cache_dir) if cache_dir else None)
    workflow_local_dir = cache_root / "workflow" / "local"
    workflow_local_dir.mkdir(parents=True, exist_ok=True)

    workflow_hash = sha256(workflow_id.encode()).hexdigest()
    file_path = workflow_local_dir / f"{workflow_hash}.json"
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=workflow_local_dir,
            prefix=".local-workflow.",
            suffix=".tmp",
            delete=False,
        ) as handle:
            temporary_path = handle.name
            json.dump(payload, handle, indent=2)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, file_path)
        temporary_path = None
    finally:
        if temporary_path is not None:
            try:
                os.unlink(temporary_path)
            except OSError:
                pass

    return file_path.resolve()
