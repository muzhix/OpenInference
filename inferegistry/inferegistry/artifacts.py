"""Build Roboflow-compatible ``package_artifacts`` identities for local files."""

from __future__ import annotations

import hashlib
from pathlib import Path


def md5_file(path: Path) -> str:
    """Return the MD5 hex digest of a regular file.

    Args:
        path: Path to a regular file.

    Returns:
        32-character lowercase hex MD5 digest.
    """
    digest = hashlib.md5()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)

    return digest.hexdigest()


def sha256_file(path: Path) -> str:
    """Return the SHA-256 hex digest of a regular file.

    Args:
        path: Path to a regular file.

    Returns:
        64-character lowercase hex SHA-256 digest.
    """
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)

    return digest.hexdigest()


def package_artifact_identity(file_handle: str, path: Path) -> dict:
    """Build a hashed in-package artifact identity for ``dump_model_config_for_offline_use``.

    Args:
        file_handle: Relative path inside the package (e.g. ``weights.onnx``).
        path: Absolute path to the on-disk file whose bytes are hashed.

    Returns:
        Identity dict with the exact key set required by inference-models.
    """
    if path.is_symlink() or not path.is_file():
        raise ValueError(
            f"Package artefact `{file_handle}` must be a regular file, got {path}"
        )

    identity = {
        "file_handle": file_handle,
        "md5_hash": md5_file(path),
        "unhashed": False,
        "sha256_hash": None,
        "source_hash": None,
        "storage": "package_file",
    }

    return identity


def build_package_artifacts(files: dict[str, Path]) -> list[dict]:
    """Build sorted ``package_artifacts`` for a mapping of handle → path.

    Args:
        files: Mapping of package-relative file handle to absolute path.

    Returns:
        Sorted list of artifact identity dicts.
    """
    identities = [
        package_artifact_identity(file_handle=handle, path=path)
        for handle, path in files.items()
    ]
    identities.sort(
        key=lambda item: (item["file_handle"].casefold(), item["file_handle"])
    )

    return identities
