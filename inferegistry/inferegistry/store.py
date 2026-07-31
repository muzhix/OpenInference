"""Filesystem index + package lookup for InferGraph Registry."""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
from typing import Any, Optional
from inference_models.models.auto_loaders.model_cache_paths import (
    generate_model_package_cache_path,
)

from inferegistry._paths import apply_cache_dir, resolve_cache_dir

INDEX_FILENAME = "index.json"
MODEL_CONFIG_JSON = "model_config.json"


def encode_model_id_for_path(model_id: str) -> str:
    """Encode model ids so a single path segment can contain ``/`` safely."""
    return model_id.replace("/", "::")


def decode_model_id_from_path(value: str) -> str:
    """Inverse of ``encode_model_id_for_path``."""
    return value.replace("::", "/")


_BACKEND_MANIFEST = {
    "onnx": {
        "type": "onnx-model-package-v1",
        "backendType": "onnx",
        "dynamicBatchSize": True,
        "staticBatchSize": None,
        "quantization": "fp32",
        "opset": 17,
    },
    "torch": {
        "type": "torch-model-package-v1",
        "backendType": "torch",
        "dynamicBatchSize": True,
        "staticBatchSize": None,
        "quantization": "fp32",
    },
    "trt": {
        "type": "trt-model-package-v1",
        "backendType": "trt",
        "dynamicBatchSize": True,
        "staticBatchSize": None,
        "quantization": "fp32",
        "minBatchSize": 1,
        "optBatchSize": 1,
        "maxBatchSize": 8,
        "machineType": "gpu-server",
        "machineSpecs": {
            "type": "gpu-server-specs-v1",
            "cudaDeviceType": "unknown",
            "cudaDeviceCC": "8.0",
            "cudaVersion": "12.0",
            "trtVersion": "10.0",
            "driverVersion": "550.0",
            "osVersion": "linux",
        },
    },
}


def _is_within(root: Path, candidate: Path) -> bool:
    try:
        candidate.resolve().relative_to(root.resolve())
    except ValueError:
        return False
    return True


class RegistryStore:
    """JSON index backed by on-disk models-cache packages."""

    def __init__(self, root: str | Path, *, public_base_url: str = "") -> None:
        self.root = apply_cache_dir(resolve_cache_dir(str(root)))
        self.root.mkdir(parents=True, exist_ok=True)
        self.public_base_url = public_base_url.rstrip("/")
        self.index_path = self.root / INDEX_FILENAME

    def _read_index(self) -> dict[str, Any]:
        if not self.index_path.is_file():
            return {"models": {}}
        content = json.loads(self.index_path.read_text(encoding="utf-8"))
        if not isinstance(content, dict):
            raise ValueError(f"Corrupt registry index at {self.index_path}")
        models = content.get("models")
        if not isinstance(models, dict):
            content["models"] = {}
        return content

    def _write_index(self, index: dict[str, Any]) -> None:
        temporary = self.index_path.with_suffix(".tmp")
        temporary.write_text(json.dumps(index, indent=2, sort_keys=True), encoding="utf-8")
        os.replace(temporary, self.index_path)

    def list_models(self) -> list[dict[str, Any]]:
        index = self._read_index()
        models = []
        for model_id, entry in sorted(index["models"].items()):
            models.append({"modelId": model_id, **entry})
        return models

    def get_model(self, model_id: str) -> Optional[dict[str, Any]]:
        index = self._read_index()
        entry = index["models"].get(model_id)
        if entry is None:
            return None
        return {"modelId": model_id, **entry}

    def package_dir(self, model_id: str, package_id: str) -> Path:
        apply_cache_dir(self.root)
        path = Path(
            generate_model_package_cache_path(model_id=model_id, package_id=package_id)
        )
        if not _is_within(self.root, path):
            raise ValueError("Resolved package path escapes registry root")
        return path

    def resolve_artifact_path(
        self,
        model_id: str,
        package_id: str,
        file_handle: str,
    ) -> Path:
        if (
            not file_handle
            or file_handle.startswith("/")
            or "\\" in file_handle
            or ".." in Path(file_handle).parts
        ):
            raise ValueError(f"Unsafe file handle: {file_handle!r}")

        entry = self.get_model(model_id)
        if entry is None:
            raise FileNotFoundError(f"Unknown model `{model_id}`")
        packages = entry.get("packages") or []
        if package_id not in packages:
            raise FileNotFoundError(
                f"Unknown package `{package_id}` for model `{model_id}`"
            )

        package_dir = self.package_dir(model_id, package_id)
        target = (package_dir / file_handle).resolve()
        if not _is_within(package_dir, target):
            raise ValueError("Artifact path escapes package directory")
        if target.is_symlink() or not target.is_file():
            raise FileNotFoundError(f"Artifact not found: {file_handle}")
        return target

    def register_package(
        self,
        *,
        model_id: str,
        package_id: str = "default",
    ) -> dict[str, Any]:
        """Index an already-packed models-cache package."""
        package_dir = self.package_dir(model_id, package_id)
        config_path = package_dir / MODEL_CONFIG_JSON
        if not config_path.is_file():
            raise FileNotFoundError(
                f"No {MODEL_CONFIG_JSON} for {model_id}/{package_id} at {package_dir}"
            )
        config = json.loads(config_path.read_text(encoding="utf-8"))
        if not isinstance(config, dict):
            raise ValueError("model_config.json must be an object")

        task_type = config.get("task_type")
        architecture = config.get("model_architecture")
        if not isinstance(task_type, str) or not task_type:
            raise ValueError("model_config.json missing task_type")
        if not isinstance(architecture, str) or not architecture:
            raise ValueError("model_config.json missing model_architecture")

        index = self._read_index()
        existing = index["models"].get(model_id, {})
        packages = list(existing.get("packages") or [])
        if package_id not in packages:
            packages.append(package_id)
        entry = {
            "taskType": task_type,
            "modelArchitecture": architecture,
            "modelVariant": config.get("model_variant"),
            "backendType": config.get("backend_type"),
            "trustedSource": bool(config.get("trusted_source")),
            "packages": packages,
            "packagePath": str(package_dir.relative_to(self.root)),
        }
        index["models"][model_id] = entry
        self._write_index(index)
        return {"modelId": model_id, **entry}

    def delete_model(self, model_id: str, *, delete_files: bool = False) -> bool:
        index = self._read_index()
        entry = index["models"].pop(model_id, None)
        if entry is None:
            return False
        self._write_index(index)
        if delete_files:
            for package_id in entry.get("packages") or []:
                package_dir = self.package_dir(model_id, package_id)
                if package_dir.is_dir() and _is_within(self.root, package_dir):
                    shutil.rmtree(package_dir)
        return True

    def validate_package(
        self,
        *,
        model_id: str,
        package_id: str = "default",
    ) -> dict[str, Any]:
        package_dir = self.package_dir(model_id, package_id)
        config_path = package_dir / MODEL_CONFIG_JSON
        if not config_path.is_file():
            raise FileNotFoundError(f"Missing {MODEL_CONFIG_JSON}")
        config = json.loads(config_path.read_text(encoding="utf-8"))
        artifacts = config.get("package_artifacts") or []
        missing = []
        for artifact in artifacts:
            if not isinstance(artifact, dict):
                continue
            handle = artifact.get("file_handle")
            if not isinstance(handle, str):
                continue
            path = package_dir / handle
            if not path.is_file() or path.is_symlink():
                missing.append(handle)
        result = {
            "modelId": model_id,
            "packageId": package_id,
            "ok": not missing,
            "missingArtifacts": missing,
            "packageDir": str(package_dir),
        }
        return result

    def build_stat_response(self, model_id: str) -> dict[str, Any]:
        entry = self.get_model(model_id)
        if entry is None:
            raise FileNotFoundError(model_id)
        return {
            "status": "ok",
            "modelMetadata": {
                "type": "external-model-stat-metadata-v1",
                "modelId": model_id,
                "modelArchitecture": entry["modelArchitecture"],
                "taskType": entry["taskType"],
                "modelVariant": entry.get("modelVariant"),
            },
        }

    def build_weights_response(
        self,
        model_id: str,
        *,
        page_size: Optional[int] = None,
        start_after: Optional[str] = None,
    ) -> dict[str, Any]:
        entry = self.get_model(model_id)
        if entry is None:
            raise FileNotFoundError(model_id)

        package_ids = list(entry.get("packages") or [])
        if start_after:
            try:
                start_index = package_ids.index(start_after) + 1
            except ValueError:
                start_index = 0
            package_ids = package_ids[start_index:]
        next_page = None
        if page_size is not None and page_size > 0 and len(package_ids) > page_size:
            next_page = package_ids[page_size - 1]
            package_ids = package_ids[:page_size]

        model_packages = [
            self._build_package_payload(model_id=model_id, package_id=package_id)
            for package_id in package_ids
        ]
        return {
            "status": "ok",
            "modelMetadata": {
                "type": "external-model-metadata-v1",
                "modelId": model_id,
                "modelArchitecture": entry["modelArchitecture"],
                "taskType": entry["taskType"],
                "modelVariant": entry.get("modelVariant"),
                "modelPackages": model_packages,
                "nextPage": next_page,
            },
        }

    def _build_package_payload(
        self,
        *,
        model_id: str,
        package_id: str,
    ) -> dict[str, Any]:
        package_dir = self.package_dir(model_id, package_id)
        config = json.loads((package_dir / MODEL_CONFIG_JSON).read_text(encoding="utf-8"))
        backend = config.get("backend_type") or "onnx"
        manifest = dict(_BACKEND_MANIFEST.get(backend, _BACKEND_MANIFEST["onnx"]))
        if config.get("quantization"):
            manifest["quantization"] = config["quantization"]
        if config.get("dynamic_batch_size_supported") is not None:
            manifest["dynamicBatchSize"] = bool(config["dynamic_batch_size_supported"])
        if "static_batch_size" in config:
            manifest["staticBatchSize"] = config.get("static_batch_size")

        package_files = []
        for artifact in config.get("package_artifacts") or []:
            if not isinstance(artifact, dict):
                continue
            handle = artifact.get("file_handle")
            if not isinstance(handle, str):
                continue
            download_url = (
                f"{self.public_base_url}/artifacts/"
                f"{encode_model_id_for_path(model_id)}/{package_id}/{handle}"
            )

            package_files.append(
                {
                    "fileHandle": handle,
                    "downloadUrl": download_url,
                    "md5Hash": artifact.get("md5_hash"),
                }
            )

        return {
            "type": "external-model-package-v1",
            "packageId": package_id,
            "trustedSource": bool(config.get("trusted_source")),
            "packageManifest": manifest,
            "packageFiles": package_files,
        }
