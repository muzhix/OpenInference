"""Click CLI for InferGraph pack / import / registry serve."""

from __future__ import annotations

import json

import click

from inferegistry.import_cache import import_roboflow_cache
from inferegistry.import_workflow import import_workflow
from inferegistry.pack import pack_model
from inferegistry.store import RegistryStore


@click.group()
def main() -> None:
    """InferGraph registry CLI — pack, import, and HTTP Registry."""


@main.command("pack")
@click.option(
    "--model-id",
    required=True,
    help="Model id used at inference time (e.g. my-det/1).",
)
@click.option(
    "--weights",
    required=True,
    type=click.Path(exists=True, dir_okay=False, path_type=str),
    help="Path to weights (.onnx / .pt / .engine).",
)
@click.option(
    "--task",
    required=True,
    help="Task type (e.g. object-detection).",
)
@click.option(
    "--architecture",
    required=True,
    help="Model architecture (e.g. yolov8).",
)
@click.option(
    "--class-names",
    required=True,
    type=click.Path(exists=True, dir_okay=False, path_type=str),
    help="Path to class_names.txt (one class per line).",
)
@click.option(
    "--inference-config",
    default=None,
    type=click.Path(exists=True, dir_okay=False, path_type=str),
    help="Optional inference_config.json path.",
)
@click.option(
    "--cache-dir",
    default=None,
    type=click.Path(file_okay=False, path_type=str),
    help="Model cache root (default: INFERENCE_HOME / MODEL_CACHE_DIR).",
)
@click.option(
    "--package-id",
    default="default",
    show_default=True,
    help="Alphanumeric package id under models-cache.",
)
@click.option(
    "--backend",
    default=None,
    help="Backend override (onnx / torch / trt). Inferred from weights suffix when omitted.",
)
@click.option(
    "--pin-runtime/--no-pin-runtime",
    default=False,
    show_default=True,
    help=(
        "Embed runtime_compatibility_hash (torch/CUDA/ORT). "
        "Default off = portable cold pack; use for TRT/CUDA-specific engines."
    ),
)
def pack_command(
    model_id: str,
    weights: str,
    task: str,
    architecture: str,
    class_names: str,
    inference_config: str | None,
    cache_dir: str | None,
    package_id: str,
    backend: str | None,
    pin_runtime: bool,
) -> None:
    """Pack weights into an InferGraph models-cache package and register it."""
    package_dir = pack_model(
        model_id=model_id,
        weights=weights,
        task=task,
        architecture=architecture,
        class_names=class_names,
        inference_config=inference_config,
        cache_dir=cache_dir,
        package_id=package_id,
        backend=backend,
        pin_runtime=pin_runtime,
    )
    click.echo(f"Packed model `{model_id}` -> {package_dir}")
    if pin_runtime:
        click.echo(
            "Note: package is pinned to this host's runtime; "
            "OFFLINE loads on a different torch/CUDA/ORT will skip it."
        )


@main.command("import-roboflow-cache")
@click.option(
    "--source",
    required=True,
    type=click.Path(exists=True, file_okay=False, path_type=str),
    help="Directory with traditional and/or models-cache packages.",
)
@click.option(
    "--cache-dir",
    default=None,
    type=click.Path(file_okay=False, path_type=str),
    help="Destination InferGraph cache root.",
)
def import_roboflow_cache_command(source: str, cache_dir: str | None) -> None:
    """Import a Roboflow-compatible cache tree into the local cache."""
    result = import_roboflow_cache(source=source, cache_dir=cache_dir)
    click.echo(json.dumps(result, indent=2))


@main.command("import-workflow")
@click.option(
    "--workflow-id",
    required=True,
    help="Local workflow id (letters, numbers, _ , -).",
)
@click.option(
    "--source",
    required=True,
    type=click.Path(exists=True, dir_okay=False, path_type=str),
    help="Path to workflow JSON.",
)
@click.option(
    "--cache-dir",
    default=None,
    type=click.Path(file_okay=False, path_type=str),
    help="Cache root containing workflow/local/.",
)
def import_workflow_command(
    workflow_id: str,
    source: str,
    cache_dir: str | None,
) -> None:
    """Import a workflow JSON into local builder storage."""
    path = import_workflow(
        workflow_id=workflow_id,
        source=source,
        cache_dir=cache_dir,
    )
    click.echo(f"Imported workflow `{workflow_id}` -> {path}")


@main.command("convert")
@click.option(
    "--source",
    required=True,
    type=click.Path(exists=True, path_type=str),
    help="Traditional package dir or warm cache root containing model_type.json.",
)
@click.option(
    "--model-id",
    default=None,
    help="Target model id (e.g. demo/1). Selects among packages when source is a root.",
)
@click.option(
    "--cache-dir",
    default=None,
    type=click.Path(file_okay=False, path_type=str),
    help="Destination InferGraph cache root.",
)
@click.option(
    "--package-id",
    default="default",
    show_default=True,
    help="models-cache package id.",
)
@click.option("--task", default=None, help="Override task from model_type.json.")
@click.option(
    "--architecture",
    default=None,
    help="Override architecture from model_type.json.",
)
def convert_command(
    source: str,
    model_id: str | None,
    cache_dir: str | None,
    package_id: str,
    task: str | None,
    architecture: str | None,
) -> None:
    """Convert a traditional cache package into InferGraph models-cache."""
    from inferegistry.convert import convert_traditional_package

    package_dir = convert_traditional_package(
        source=source,
        model_id=model_id,
        cache_dir=cache_dir,
        package_id=package_id,
        task=task,
        architecture=architecture,
    )
    click.echo(f"Converted -> {package_dir}")


@main.command("register")
@click.option(
    "--model-id",
    required=True,
    help="Model id already present under models-cache.",
)
@click.option(
    "--package-id",
    default="default",
    show_default=True,
)
@click.option(
    "--cache-dir",
    default=None,
    type=click.Path(file_okay=False, path_type=str),
    help="Registry root containing models-cache + index.json.",
)
def register_command(
    model_id: str,
    package_id: str,
    cache_dir: str | None,
) -> None:
    """Register an already-packed package into the registry index."""
    from inferegistry._paths import resolve_cache_dir

    store = RegistryStore(resolve_cache_dir(cache_dir))
    entry = store.register_package(model_id=model_id, package_id=package_id)
    click.echo(json.dumps(entry, indent=2))


@main.command("serve")
@click.option(
    "--host",
    default="0.0.0.0",
    show_default=True,
)
@click.option(
    "--port",
    default=8000,
    show_default=True,
    type=int,
)
@click.option(
    "--registry-root",
    default=None,
    type=click.Path(file_okay=False, path_type=str),
    help="Registry root (default: INFERGRAPH_REGISTRY_ROOT / INFERENCE_HOME).",
)
@click.option(
    "--public-base-url",
    default=None,
    help="Base URL embedded in downloadUrl fields.",
)
def serve_command(
    host: str,
    port: int,
    registry_root: str | None,
    public_base_url: str | None,
) -> None:
    """Run the InferGraph Registry HTTP service."""
    import uvicorn

    from inferegistry.app import create_app

    public_base = public_base_url or f"http://127.0.0.1:{port}"
    app = create_app(registry_root=registry_root, public_base_url=public_base)
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
