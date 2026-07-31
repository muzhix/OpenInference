"""Import Roboflow-compatible cache trees into a local InferGraph cache."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Iterable

from inference_models.models.auto_loaders.model_cache_paths import (
    generate_model_package_cache_path,
)

from inferegistry._paths import apply_cache_dir, resolve_cache_dir

MODEL_TYPE_JSON = "model_type.json"
MODEL_CONFIG_JSON = "model_config.json"
MODELS_CACHE_DIRNAME = "models-cache"


def _is_within(root: Path, candidate: Path) -> bool:
    try:
        candidate.resolve().relative_to(root.resolve())
    except ValueError:
        return False
    return True


def _reject_symlink(path: Path, *, label: str) -> None:
    if path.is_symlink():
        raise ValueError(f"Refusing to import symlink {label}: {path}")


def _copy_tree(source: Path, destination: Path) -> None:
    _reject_symlink(source, label="source tree")
    if destination.exists():
        _reject_symlink(destination, label="destination")
        if destination.is_dir():
            shutil.rmtree(destination)
        else:
            destination.unlink()
    shutil.copytree(source, destination, symlinks=False)


def _iter_files(root: Path, name: str) -> Iterable[Path]:
    for path in root.rglob(name):
        if path.is_file() and not path.is_symlink():
            yield path


def _import_traditional_packages(source: Path, cache_dir: Path) -> list[str]:
    imported: list[str] = []
    for model_type_path in _iter_files(source, MODEL_TYPE_JSON):
        package_dir = model_type_path.parent
        relative = package_dir.relative_to(source)
        if relative.parts and relative.parts[0] == MODELS_CACHE_DIRNAME:
            continue
        destination = cache_dir / relative
        if not _is_within(cache_dir, destination):
            raise ValueError(f"Refusing path escape for traditional package {relative}")
        _copy_tree(package_dir, destination)
        imported.append(str(relative))

    return imported


def _read_model_config(path: Path) -> dict:
    content = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(content, dict):
        raise ValueError(f"Invalid {MODEL_CONFIG_JSON} at {path}")

    return content


def _import_single_models_package(
    package_dir: Path,
    cache_dir: Path,
    *,
    package_id: str = "default",
) -> str:
    config = _read_model_config(package_dir / MODEL_CONFIG_JSON)
    model_id = config.get("model_id") or config.get("canonical_model_id")
    if not isinstance(model_id, str) or not model_id.strip():
        raise ValueError(
            f"Cannot import package at {package_dir}: model_config.json lacks model_id"
        )
    destination = Path(
        generate_model_package_cache_path(model_id=model_id, package_id=package_id)
    )
    if not _is_within(cache_dir, destination):
        raise ValueError(f"Refusing path escape for models-cache package {model_id}")
    _copy_tree(package_dir, destination)

    return str(destination.relative_to(cache_dir))


def _import_models_cache_packages(source: Path, cache_dir: Path) -> list[str]:
    imported: list[str] = []

    # Case A: source itself is one platform / models-cache package.
    if (source / MODEL_CONFIG_JSON).is_file():
        imported.append(
            _import_single_models_package(source, cache_dir, package_id="default")
        )
        return imported

    models_cache_root = (
        source / MODELS_CACHE_DIRNAME
        if (source / MODELS_CACHE_DIRNAME).is_dir()
        else None
    )
    if models_cache_root is None:
        # Case B: source may contain nested package dirs with model_config.json
        # that are not under models-cache/ (e.g. a folder of exports).
        for model_config_path in _iter_files(source, MODEL_CONFIG_JSON):
            package_dir = model_config_path.parent
            imported.append(
                _import_single_models_package(
                    package_dir, cache_dir, package_id="default"
                )
            )
        return imported

    # Case C: full cache root with models-cache/{slug}/{package_id}/
    destination_root = cache_dir / MODELS_CACHE_DIRNAME
    destination_root.mkdir(parents=True, exist_ok=True)
    for model_config_path in _iter_files(models_cache_root, MODEL_CONFIG_JSON):
        package_dir = model_config_path.parent
        relative = package_dir.relative_to(models_cache_root)
        destination = destination_root / relative
        if not _is_within(cache_dir, destination):
            raise ValueError(f"Refusing path escape for models-cache package {relative}")
        _copy_tree(package_dir, destination)
        imported.append(str(Path(MODELS_CACHE_DIRNAME) / relative))

    return imported


def import_roboflow_cache(
    *,
    source: str | Path,
    cache_dir: str | Path | None = None,
) -> dict[str, list[str]]:
    """Import traditional and/or models-cache packages into ``cache_dir``.

    Args:
        source: Directory containing a warm Roboflow cache, a ``models-cache``
            subtree, or a single platform/traditional package.
        cache_dir: Destination InferGraph cache root.

    Returns:
        Dict with ``traditional`` and ``models_cache`` lists of imported
        relative package paths.
    """
    source_path = Path(source).expanduser().resolve()
    if not source_path.is_dir() or source_path.is_symlink():
        raise ValueError(f"Source must be a regular directory: {source_path}")

    resolved_cache = apply_cache_dir(
        resolve_cache_dir(str(cache_dir) if cache_dir else None)
    )
    resolved_cache.mkdir(parents=True, exist_ok=True)

    traditional = _import_traditional_packages(source_path, resolved_cache)
    models_cache = _import_models_cache_packages(source_path, resolved_cache)

    if not traditional and not models_cache:
        raise ValueError(
            f"No `{MODEL_TYPE_JSON}` or `{MODEL_CONFIG_JSON}` packages found under "
            f"{source_path}"
        )

    result = {
        "traditional": traditional,
        "models_cache": models_cache,
        "cache_dir": str(resolved_cache),
    }

    return result
