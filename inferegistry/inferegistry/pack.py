"""Pack weights + metadata into an InferGraph (inference-models) cache package."""

from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path
from typing import Optional

from inference_models.configuration import FILE_LOCK_ACQUIRE_TIMEOUT
from inference_models.models.auto_loaders import core as auto_loaders_core
from inference_models.models.auto_loaders.entities import BackendType
from inference_models.models.auto_loaders.model_cache_paths import (
    generate_model_package_cache_path,
)
from inference_models.runtime_introspection.core import x_ray_runtime_environment

from inferegistry._paths import apply_cache_dir, resolve_cache_dir
from inferegistry.artifacts import build_package_artifacts, sha256_file

_WEIGHTS_BASENAME_BY_SUFFIX = {
    ".onnx": "weights.onnx",
    ".pt": "weights.pt",
    ".pth": "weights.pt",
    ".engine": "weights.engine",
}

_BACKEND_BY_SUFFIX = {
    ".onnx": BackendType.ONNX,
    ".pt": BackendType.TORCH,
    ".pth": BackendType.TORCH,
    ".engine": BackendType.TRT,
}

CLASS_NAMES_HANDLE = "class_names.txt"
INFERENCE_CONFIG_HANDLE = "inference_config.json"


def infer_backend(weights_path: Path, backend: Optional[str] = None) -> BackendType:
    """Resolve backend from an explicit value or weights file suffix.

    Args:
        weights_path: Path to the weights file.
        backend: Optional backend string (e.g. ``onnx``, ``torch``).

    Returns:
        Resolved ``BackendType``.

    Raises:
        ValueError: If backend cannot be determined.
    """
    if backend:
        try:
            return BackendType(backend)
        except ValueError as error:
            raise ValueError(
                f"Unsupported backend `{backend}`. "
                f"Expected one of: {[item.value for item in BackendType]}"
            ) from error

    suffix = weights_path.suffix.lower()
    if suffix not in _BACKEND_BY_SUFFIX:
        raise ValueError(
            f"Cannot infer backend from weights suffix `{suffix}`. "
            "Pass --backend explicitly."
        )

    return _BACKEND_BY_SUFFIX[suffix]


def weights_file_handle(weights_path: Path) -> str:
    """Return the in-package file handle for a weights file.

    Args:
        weights_path: Source weights path.

    Returns:
        Package-relative weights filename.
    """
    suffix = weights_path.suffix.lower()
    if suffix in _WEIGHTS_BASENAME_BY_SUFFIX:
        return _WEIGHTS_BASENAME_BY_SUFFIX[suffix]

    return f"weights{suffix}"


def _reject_symlink(path: Path, *, label: str) -> None:
    if path.is_symlink():
        raise ValueError(f"Refusing to pack symlink {label}: {path}")


def _copy_regular_file(source: Path, destination: Path) -> None:
    _reject_symlink(source, label="source")
    if not source.is_file():
        raise ValueError(f"Expected a regular file at {source}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() or destination.is_symlink():
        if destination.is_dir() and not destination.is_symlink():
            raise ValueError(f"Refusing to overwrite directory at {destination}")
        destination.unlink()
    shutil.copyfile(source, destination, follow_symlinks=False)


def _offline_compatibility_hash(files: dict[str, Path]) -> str:
    """Derive a stable 64-hex offline hash from packed file contents."""
    hasher = hashlib.sha256()
    for handle in sorted(files, key=lambda item: item.casefold()):
        hasher.update(handle.encode("utf-8"))
        hasher.update(b"\0")
        hasher.update(sha256_file(files[handle]).encode("utf-8"))
        hasher.update(b"\0")

    return hasher.hexdigest()


def pack_model(
    *,
    model_id: str,
    weights: str | Path,
    task: str,
    architecture: str,
    class_names: str | Path,
    inference_config: Optional[str | Path] = None,
    cache_dir: Optional[str | Path] = None,
    package_id: str = "default",
    backend: Optional[str] = None,
) -> Path:
    """Pack model artefacts into ``models-cache`` for offline InferGraph use.

    Args:
        model_id: Model identifier used at inference time (e.g. ``my-det/1``).
        weights: Path to weights (``.onnx`` / ``.pt`` / ``.engine``).
        task: Task type (e.g. ``object-detection``).
        architecture: Model architecture (e.g. ``yolov8``).
        class_names: Path to a text file with one class name per line.
        inference_config: Optional path to ``inference_config.json``.
        cache_dir: Cache root; defaults to ``INFERENCE_HOME`` / ``MODEL_CACHE_DIR``.
        package_id: OS-safe alphanumeric package id (default ``default``).
        backend: Optional backend override; otherwise inferred from weights suffix.

    Returns:
        Absolute path to the written package directory.
    """
    if not isinstance(model_id, str) or not model_id.strip():
        raise ValueError("model_id must be a non-empty string")

    weights_path = Path(weights).expanduser().resolve()
    class_names_path = Path(class_names).expanduser().resolve()
    inference_config_path = (
        Path(inference_config).expanduser().resolve()
        if inference_config is not None
        else None
    )

    resolved_cache = apply_cache_dir(resolve_cache_dir(str(cache_dir) if cache_dir else None))
    backend_type = infer_backend(weights_path, backend=backend)
    weights_handle = weights_file_handle(weights_path)

    package_dir = Path(
        generate_model_package_cache_path(model_id=model_id, package_id=package_id)
    )
    package_dir.mkdir(parents=True, exist_ok=True)

    packed_files: dict[str, Path] = {}
    destination_weights = package_dir / weights_handle
    _copy_regular_file(weights_path, destination_weights)
    packed_files[weights_handle] = destination_weights

    destination_class_names = package_dir / CLASS_NAMES_HANDLE
    _copy_regular_file(class_names_path, destination_class_names)
    packed_files[CLASS_NAMES_HANDLE] = destination_class_names

    if inference_config_path is not None:
        destination_inference_config = package_dir / INFERENCE_CONFIG_HANDLE
        _copy_regular_file(inference_config_path, destination_inference_config)
        packed_files[INFERENCE_CONFIG_HANDLE] = destination_inference_config

    package_artifacts = build_package_artifacts(packed_files)
    runtime_hash = auto_loaders_core._runtime_compatibility_hash(
        runtime_x_ray=x_ray_runtime_environment()
    )
    # Leave offline_compatibility_hash unset for cold packs.
    # Loader constraint hashes are only known at warm/load time; a content-based
    # stand-in would never match and block OFFLINE_MODE loads (see auto_loaders).
    config_path = str(package_dir / "model_config.json")

    auto_loaders_core.dump_model_config_for_offline_use(
        config_path,
        architecture,
        task,
        backend_type,
        FILE_LOCK_ACQUIRE_TIMEOUT,
        model_id=model_id,
        canonical_model_id=model_id,
        trusted_source=True,
        model_dependencies=[],
        package_artifacts=package_artifacts,
        dependency_package_paths=[],
        runtime_compatibility_hash=runtime_hash,
        offline_compatibility_hash=None,
    )

    from inferegistry.store import RegistryStore

    RegistryStore(resolved_cache).register_package(
        model_id=model_id,
        package_id=package_id,
    )

    return package_dir.resolve()


def minimal_inference_config(
    *,
    height: int = 640,
    width: int = 640,
) -> dict:
    """Return a minimal object-detection ``inference_config.json`` body.

    Args:
        height: Network input height.
        width: Network input width.

    Returns:
        Inference config dict suitable for yolov8-style ONNX packages.
    """
    config = {
        "image_pre_processing": {
            "auto-orient": {"enabled": True},
        },
        "network_input": {
            "training_input_size": {"height": height, "width": width},
            "dynamic_spatial_size_supported": True,
            "dynamic_spatial_size_mode": {
                "type": "pad-to-be-divisible",
                "value": 32,
            },
            "color_mode": "rgb",
            "resize_mode": "letterbox",
            "padding_value": 114,
            "input_channels": 3,
            "scaling_factor": 255.0,
        },
        "forward_pass": {
            "static_batch_size": None,
            "max_dynamic_batch_size": 8,
        },
        "post_processing": {
            "type": "nms",
            "fused": False,
        },
    }

    return config


def write_minimal_inference_config(path: Path, *, height: int = 640, width: int = 640) -> Path:
    """Write a minimal inference_config.json for tests / quick packs.

    Args:
        path: Destination file path.
        height: Network input height.
        width: Network input width.

    Returns:
        Path written.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(minimal_inference_config(height=height, width=width), indent=2),
        encoding="utf-8",
    )

    return path
