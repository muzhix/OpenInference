"""Workflow Studio run endpoint — executes specs through the workflows engine.

Mirrors ``POST /workflows/run`` (``inference_server.workflows.router``) with
the small differences the editor needs: editor-only ``metadata`` is stripped
from the specification, frontend image descriptors are normalized, and engine
failures surface as a single ``execution_error`` payload.
"""

from __future__ import annotations

import re
from typing import Any, Dict, Optional

from fastapi import Request
from starlette.concurrency import run_in_threadpool

from inference_server.workflow_studio.spec_models import normalize_steps_collection

# Editor token for "every property of this step, as one JSON object".
# The engine selector for that value is ``$steps.<name>.*``.
_ALL_PROPERTIES_OUTPUT = re.compile(r"^(\$steps\.[A-Za-z0-9_]+)\.all_properties$")

# Frontend-only keys that the execution engine must never see.
_FRONTEND_ONLY_IMAGE_KEYS = ("validUrl",)

_IMAGE_DESCRIPTOR_TYPES = {"base64", "url"}


def prepare_specification(specification: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize a specification for the execution engine.

    Unwraps a cloud-style ``{"specification": {...}}`` wrapper, converts
    name-keyed ``steps`` dictionaries into the canonical list form, strips
    editor-only ``metadata``, and rewrites a workflow output bound to
    ``$steps.<name>.all_properties`` into ``$steps.<name>.*``. The engine
    resolves that selector to one JSON object of every property the step
    produced.

    Args:
        specification: Specification mapping as sent by the editor.

    Returns:
        Engine-ready specification mapping.
    """
    spec = dict(specification)
    inner = spec.get("specification")
    if isinstance(inner, dict) and not any(
        key in spec for key in ("version", "inputs", "steps", "outputs")
    ):
        spec = dict(inner)

    spec = normalize_steps_collection(spec_dict=spec)
    spec.pop("metadata", None)
    prepared = _rewrite_all_properties_outputs(spec=spec)

    return prepared


def _rewrite_all_properties_outputs(*, spec: Dict[str, Any]) -> Dict[str, Any]:
    """Point all-properties workflow outputs at the engine wildcard selector."""
    outputs = spec.get("outputs")
    if not isinstance(outputs, list):
        return spec

    rewritten_outputs = []
    for output in outputs:
        if not isinstance(output, dict):
            rewritten_outputs.append(output)
            continue

        selector = output.get("selector")
        if not isinstance(selector, str):
            rewritten_outputs.append(output)
            continue

        match = _ALL_PROPERTIES_OUTPUT.match(selector)
        if match is None:
            rewritten_outputs.append(output)
            continue

        rewritten_outputs.append({**output, "selector": f"{match.group(1)}.*"})

    spec["outputs"] = rewritten_outputs

    return spec


def normalize_run_inputs(inputs: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize editor run inputs into engine runtime parameters.

    Strips frontend-only flags (``validUrl``) from image-like descriptors and
    leaves every other value untouched.

    Args:
        inputs: Input mapping from the run request body.

    Returns:
        Runtime parameters for the engine.
    """
    normalized = {
        name: _normalize_input_value(value=value) for name, value in inputs.items()
    }

    return normalized


def _normalize_input_value(*, value: Any) -> Any:
    if isinstance(value, dict) and _looks_like_image_descriptor(value=value):
        cleaned = {
            key: element
            for key, element in value.items()
            if key not in _FRONTEND_ONLY_IMAGE_KEYS
        }

        return cleaned

    return value


def _looks_like_image_descriptor(*, value: Dict[str, Any]) -> bool:
    declared_type = value.get("type")
    if not isinstance(declared_type, str):
        return False

    looks_like_descriptor = declared_type.lower() in _IMAGE_DESCRIPTOR_TYPES

    return looks_like_descriptor and "value" in value


async def run_studio_workflow(
    request: Request,
    *,
    specification: Dict[str, Any],
    inputs: Dict[str, Any],
    api_key: Optional[str],
    background_tasks,
) -> Dict[str, Any]:
    """Execute a specification through the workflows execution engine.

    Args:
        request: Incoming FastAPI request (provides gateway state).
        specification: Specification mapping as sent by the editor.
        inputs: Runtime parameters keyed by input name.
        api_key: Optional Roboflow API key forwarded to model steps.
        background_tasks: FastAPI background task sink handed to the engine.

    Returns:
        ``{"outputs": [...], "profiler_trace": [...]}`` payload.

    Raises:
        Exception: Whatever the engine raised; the router maps it to 422.
    """
    from roboflow_workflows.http_contract.entities import (
        WorkflowSpecificationInferenceRequest,
    )

    from inference_server.legacy.bridge import SyncLegacyBridge
    from inference_server.workflows import execution
    from inference_server.workflows.models_provider import GatewayModelsProvider

    prepared_specification = prepare_specification(specification=specification)
    runtime_parameters = normalize_run_inputs(inputs=inputs)

    bridge = SyncLegacyBridge(
        request.app.state.legacy_bridge, request.app.state.loop_bridge
    )
    provider = GatewayModelsProvider(bridge, api_key, request.scope["path"])
    init_parameters = execution.build_init_parameters(
        provider=provider,
        api_key=api_key,
        background_tasks=background_tasks,
        disable_sinks=False,
        inner_workflow_dispatch_depth=0,
    )
    workflow_request = WorkflowSpecificationInferenceRequest(
        specification=prepared_specification,
        inputs=runtime_parameters,
        api_key=api_key,
    )
    result = await run_in_threadpool(
        execution.run_workflow_sync,
        specification=prepared_specification,
        workflow_request=workflow_request,
        init_parameters=init_parameters,
        profiler=execution.make_profiler(False),
        executor=request.app.state.workflows_executor,
        workflow_id=None,
        is_preview=False,
        debug=False,
    )
    payload = {"outputs": result.outputs, "profiler_trace": result.profiler_trace}

    return payload
