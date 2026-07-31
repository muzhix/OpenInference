"""Convert a traditional Roboflow cache package into InferGraph models-cache."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from inferegistry._paths import apply_cache_dir, resolve_cache_dir
from inferegistry.pack import pack_model, write_minimal_inference_config

MODEL_TYPE_JSON = "model_type.json"
_WEIGHTS_CANDIDATES = (
    "weights.onnx",
    "weights.pt",
    "weights.pth",
    "best.pt",
    "best.onnx",
)


def _find_traditional_package(source: Path, model_id: Optional[str]) -> Path:
    """Locate a directory containing ``model_type.json``.

    Args:
        source: Cache root or a single traditional package directory.
        model_id: Optional model id used to pick among multiple packages.

    Returns:
        Path to the traditional package directory.

    Raises:
        ValueError: If no suitable package is found.
    """
    source = source.expanduser().resolve()
    if (source / MODEL_TYPE_JSON).is_file():
        return source

    packages = [
        path.parent
        for path in source.rglob(MODEL_TYPE_JSON)
        if path.is_file() and not path.is_symlink()
        and "models-cache" not in path.parts
    ]
    if not packages:
        raise ValueError(
            f"No traditional package ({MODEL_TYPE_JSON}) under {source}. "
            "See docs/infergraph/pack.md or use `inferegistry pack`."
        )

    if model_id:
        for package in packages:
            try:
                meta = json.loads((package / MODEL_TYPE_JSON).read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                continue
            if meta.get("model_id") == model_id:
                return package
            # Match by relative path dataset/version
            rel = package.relative_to(source).as_posix()
            if rel == model_id:
                return package

    if len(packages) == 1:
        return packages[0]

    raise ValueError(
        f"Multiple traditional packages under {source}; pass --model-id to select one. "
        f"Found: {[p.relative_to(source).as_posix() for p in packages[:8]]}"
    )


def _resolve_weights(package_dir: Path) -> Path:
    for name in _WEIGHTS_CANDIDATES:
        candidate = package_dir / name
        if candidate.is_file() and not candidate.is_symlink():
            return candidate
    onnx = sorted(package_dir.glob("*.onnx"))
    if onnx:
        return onnx[0]
    pts = sorted(package_dir.glob("*.pt"))
    if pts:
        return pts[0]
    raise ValueError(
        f"No weights file found in {package_dir}. "
        f"Expected one of {_WEIGHTS_CANDIDATES}."
    )


def _resolve_class_names(package_dir: Path, scratch: Path) -> Path:
    for name in ("class_names.txt", "names.txt"):
        candidate = package_dir / name
        if candidate.is_file() and not candidate.is_symlink():
            return candidate
    # env.json sometimes embeds class names
    env_path = package_dir / "env.json"
    if env_path.is_file():
        try:
            env = json.loads(env_path.read_text(encoding="utf-8"))
            names = env.get("CLASS_MAP") or env.get("class_names")
            if isinstance(names, dict):
                ordered = [names[k] for k in sorted(names, key=lambda x: int(x))]
                out = scratch / "class_names.txt"
                out.write_text("\n".join(str(n) for n in ordered) + "\n", encoding="utf-8")
                return out
            if isinstance(names, list):
                out = scratch / "class_names.txt"
                out.write_text("\n".join(str(n) for n in names) + "\n", encoding="utf-8")
                return out
        except (json.JSONDecodeError, TypeError, ValueError):
            pass
    out = scratch / "class_names.txt"
    out.write_text("object\n", encoding="utf-8")
    return out


def convert_traditional_package(
    *,
    source: str | Path,
    model_id: Optional[str] = None,
    cache_dir: Optional[str | Path] = None,
    package_id: str = "default",
    task: Optional[str] = None,
    architecture: Optional[str] = None,
) -> Path:
    """Convert one traditional cache package into ``models-cache``.

    Args:
        source: Traditional package dir or a warm cache root.
        model_id: Target / selector model id (e.g. ``demo/1``).
        cache_dir: Destination InferGraph cache root.
        package_id: models-cache package id (default ``default``).
        task: Optional task override; else read from ``model_type.json``.
        architecture: Optional architecture override; else from metadata.

    Returns:
        Path to the written models-cache package directory.
    """
    source_path = Path(source).expanduser().resolve()
    if source_path.is_symlink() or not source_path.exists():
        raise ValueError(f"Invalid source path: {source_path}")

    package_dir = _find_traditional_package(source_path, model_id)
    meta = json.loads((package_dir / MODEL_TYPE_JSON).read_text(encoding="utf-8"))
    resolved_model_id = (
        model_id
        or meta.get("model_id")
        or (
            package_dir.relative_to(source_path).as_posix()
            if package_dir != source_path
            else package_dir.name
        )
    )
    if not isinstance(resolved_model_id, str) or "/" not in resolved_model_id:
        # traditional dirs are often dataset/version
        if package_dir != source_path:
            resolved_model_id = package_dir.relative_to(source_path).as_posix()
        else:
            raise ValueError(
                "Pass --model-id like `dataset/1`. See docs/infergraph/pack.md."
            )

    resolved_task = task or meta.get("project_task_type") or meta.get("task_type")
    resolved_arch = architecture or meta.get("model_type") or meta.get("architecture")
    if not resolved_task or not resolved_arch:
        raise ValueError(
            f"Cannot determine task/architecture from {package_dir / MODEL_TYPE_JSON}. "
            "Pass --task and --architecture, or use `inferegistry pack`."
        )

    scratch = apply_cache_dir(resolve_cache_dir(str(cache_dir) if cache_dir else None))
    scratch = Path(scratch) / ".convert-scratch"
    scratch.mkdir(parents=True, exist_ok=True)

    weights = _resolve_weights(package_dir)
    class_names = _resolve_class_names(package_dir, scratch)
    inference_config = package_dir / "inference_config.json"
    if not inference_config.is_file():
        inference_config = scratch / "inference_config.json"
        write_minimal_inference_config(inference_config)

    return pack_model(
        model_id=resolved_model_id,
        weights=weights,
        task=str(resolved_task),
        architecture=str(resolved_arch),
        class_names=class_names,
        inference_config=inference_config,
        cache_dir=cache_dir,
        package_id=package_id,
    )
