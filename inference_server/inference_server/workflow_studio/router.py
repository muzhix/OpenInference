"""HTTP API for Workflow Studio (``/api/wf/*``).

Unauthenticated localhost tool endpoints backed by the SQLite version-chain
store (:mod:`inference_server.workflow_studio.store`). Configs are accepted
and returned as JSON objects; see ``workflow_studio/README.md`` for the full
contract the frontend is built against.
"""

from __future__ import annotations

import base64
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import orjson
from fastapi import APIRouter, BackgroundTasks, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from inference_server import configuration
from inference_server.workflow_studio import registry
from inference_server.workflow_studio import run as run_module
from inference_server.workflow_studio.spec_models import (
    STARTER_CONFIG,
    SpecParseError,
    canonical_config_string,
    config_object,
    normalize_config,
    parse_workflow_specification,
)
from inference_server.workflow_studio.store import (
    WorkflowNotFoundError,
    WorkflowStudioStore,
    WorkflowUrlTakenError,
)
from inference_server.workflow_studio.validation import validate_spec

router = APIRouter(prefix="/api/wf", tags=["workflow-studio"])

_WORKFLOW_NOT_FOUND_MESSAGE = "Workflow not found"


class SaveDraftRequest(BaseModel):
    """Body of ``POST /api/wf/saveDraft``."""

    workflowId: str = Field(
        description="Id of the workflow the draft belongs to.",
        examples=["3f2b1c0d9e8a4b7fa6c5d4e3f2a1b0c9"],
    )
    config: Union[Dict[str, Any], str] = Field(
        description="Workflow config as a JSON object or a JSON-encoded string.",
    )


class SaveRequest(BaseModel):
    """Body of ``POST /api/wf/save`` — the universal write endpoint."""

    id: Optional[str] = Field(
        default=None,
        description="Workflow id; present for rename/publish operations.",
    )
    name: Optional[str] = Field(
        default=None,
        description="New display name (create or rename).",
    )
    url: Optional[str] = Field(
        default=None,
        description="Requested slug; must be unique (create or rename).",
    )
    template: Optional[str] = Field(
        default=None,
        description='Creation mode: "custom" (default) or "duplicate".',
        examples=["custom"],
    )
    sourceId: Optional[str] = Field(
        default=None,
        description='Workflow to copy from when template is "duplicate".',
    )
    config: Optional[Union[Dict[str, Any], str]] = Field(
        default=None,
        description="Initial config for creation; defaults to the starter spec.",
    )
    publish: bool = Field(
        default=False,
        description="When true together with ``id``, publish the latest version.",
    )


class DeleteRequest(BaseModel):
    """Body of ``POST /api/wf/delete``."""

    workflowIds: List[str] = Field(
        description="Ids of workflows to move to the trash.",
    )


class ValidateRequest(BaseModel):
    """Body of ``POST /api/wf/validate``."""

    config: Union[Dict[str, Any], str] = Field(
        description="Workflow config as a JSON object or a JSON-encoded string.",
    )


class RunRequest(BaseModel):
    """Body of ``POST /api/wf/run``."""

    specification: Dict[str, Any] = Field(
        description="Workflow specification to execute.",
    )
    inputs: Dict[str, Any] = Field(
        default_factory=dict,
        description="Runtime parameters keyed by input name; images are given "
        'as {"type": "base64"|"url", "value": str}.',
        examples=[{"image": {"type": "base64", "value": "..."}}],
    )
    api_key: Optional[str] = Field(
        default=None,
        description="Optional Roboflow API key forwarded to model steps.",
    )


def resolve_db_path() -> Path:
    """Return the store location: ``WORKFLOW_STUDIO_DB`` or cache-dir default."""
    configured = os.environ.get("WORKFLOW_STUDIO_DB")
    if configured:
        return Path(configured)

    db_path = Path(configuration.MODEL_CACHE_DIR) / "workflow_studio.db"

    return db_path


def _store() -> WorkflowStudioStore:
    store = WorkflowStudioStore(resolve_db_path())

    return store


def _validation_payload(config: Union[Dict[str, Any], str]) -> Dict[str, Any]:
    """Validate a config, never raising for validation findings."""
    try:
        specification = parse_workflow_specification(config)
    except SpecParseError as error:
        finding = {
            "code": "invalid_spec",
            "path": error.path,
            "message": error.message,
        }

        return {"errors": [finding], "warnings": []}

    registry_payload = registry.get_registry_payload()
    result = validate_spec(specification=specification, registry=registry_payload)

    return result


def _summary(row: Dict[str, Any]) -> Dict[str, Any]:
    published = row["last_version_id"] is not None
    has_unpublished_changes = (
        row["latest_version_id"] is not None
        and row["latest_version_id"] != row["last_version_id"]
    )

    summary = {
        "id": row["id"],
        "url": row["url"],
        "name": row["name"],
        "owner": row["owner"],
        "createdByAI": bool(row["created_by_ai"]),
        "editedByAI": bool(row["edited_by_ai"]),
        "createTime": row["created_at"],
        "updateTime": row["updated_at"],
        "published": published,
        "hasUnpublishedChanges": has_unpublished_changes,
    }

    return summary


def _full_workflow(store: WorkflowStudioStore, row: Dict[str, Any]) -> Dict[str, Any]:
    workflow = _summary(row)
    latest = store.get_spec(workflow_id=row["id"])
    workflow["config"] = config_object(latest["config"]) if latest else None
    published_version = (
        store.get_version(row["last_version_id"])
        if row["last_version_id"] is not None
        else None
    )
    workflow["lastVersionConfig"] = (
        config_object(published_version["config"]) if published_version else None
    )

    return workflow


def _version_payload(version: Dict[str, Any]) -> Dict[str, Any]:
    payload = {
        "id": version["id"],
        "name": version["name"],
        "createdAt": version["created_at"],
        "config": config_object(version["config"]),
    }

    return payload


def _not_found_response() -> JSONResponse:
    response = JSONResponse(
        status_code=404, content={"error": _WORKFLOW_NOT_FOUND_MESSAGE}
    )

    return response


@router.get(
    "/list",
    summary="List workflows (trashed excluded, no configs)",
)
async def list_workflows() -> Dict[str, Any]:
    workflows = await run_in_threadpool(_store().list_workflows)
    payload = {"workflows": [_summary(row) for row in workflows]}

    return payload


@router.get(
    "/get",
    summary="Fetch one workflow with draft and published configs",
)
async def get_workflow(url: Optional[str] = None, id: Optional[str] = None) -> Response:
    store = _store()
    row = await run_in_threadpool(store.get_workflow, url=url, workflow_id=id)
    if row is None:
        return _not_found_response()

    workflow = await run_in_threadpool(_full_workflow, store, row)
    payload = {"workflow": workflow}

    return payload


@router.get(
    "/spec",
    summary="Fetch the latest (draft) specification of a workflow",
)
async def get_spec(
    url: Optional[str] = None,
    id: Optional[str] = None,
    # preferDraft is accepted for cloud compatibility; the endpoint always
    # returns the latest (draft) version, which is what preferDraft=true asks.
    preferDraft: bool = True,
) -> Response:
    store = _store()
    row = await run_in_threadpool(store.get_workflow, url=url, workflow_id=id)
    if row is None:
        return _not_found_response()

    spec = await run_in_threadpool(store.get_spec, workflow_id=row["id"])
    workflow_spec = {
        "workflowId": row["id"],
        "workflowUrl": row["url"],
        "workspaceId": "local",
        "versionId": spec["id"] if spec else None,
        "config": config_object(spec["config"]) if spec else None,
    }
    payload = {"workflowSpec": workflow_spec}

    return payload


@router.post(
    "/saveDraft",
    summary="Append a validated draft version to a workflow",
)
async def save_draft(request: SaveDraftRequest) -> Response:
    validation = _validation_payload(request.config)
    if validation["errors"]:
        errors = validation["errors"]
        response = JSONResponse(status_code=422, content={"errors": errors})

        return response

    config = normalize_config(request.config)
    store = _store()
    try:
        version = await run_in_threadpool(
            store.save_draft,
            workflow_id=request.workflowId,
            config=canonical_config_string(config),
        )
    except WorkflowNotFoundError:
        return _not_found_response()

    row = await run_in_threadpool(store.get_workflow, workflow_id=request.workflowId)
    workflow = await run_in_threadpool(_full_workflow, store, row)
    payload = {"workflow": workflow, "version": _version_payload(version)}

    return payload


@router.post(
    "/save",
    summary="Universal write: create, duplicate, rename and publish",
)
async def save(request: SaveRequest) -> Response:
    store = _store()
    try:
        if request.id is None:
            row = await run_in_threadpool(_create_workflow, store, request=request)
        else:
            row = await run_in_threadpool(_update_workflow, store, request=request)
    except WorkflowNotFoundError:
        return _not_found_response()
    except WorkflowUrlTakenError as error:
        response = JSONResponse(
            status_code=422,
            content={
                "errors": [
                    {
                        "code": "url_taken",
                        "path": "url",
                        "message": f"Workflow url {str(error)!r} is already in use",
                    }
                ]
            },
        )

        return response

    workflow = await run_in_threadpool(_full_workflow, store, row)
    payload = {"workflow": workflow}

    return payload


def _create_workflow(
    store: WorkflowStudioStore, *, request: SaveRequest
) -> Dict[str, Any]:
    if request.template == "duplicate" and request.sourceId is not None:
        row = store.duplicate_workflow(
            source_id=request.sourceId, name=request.name, url=request.url
        )

        return row

    name = request.name or "Custom Workflow"
    config = request.config if request.config is not None else STARTER_CONFIG
    normalized = normalize_config(config)
    row = store.create_workflow(
        name=name,
        url=request.url,
        config=canonical_config_string(normalized),
    )

    return row


def _update_workflow(
    store: WorkflowStudioStore, *, request: SaveRequest
) -> Dict[str, Any]:
    row = store.rename_workflow(
        workflow_id=request.id, name=request.name, url=request.url
    )
    if request.publish:
        row = store.publish(workflow_id=request.id)

    return row


@router.post(
    "/delete",
    summary="Soft-delete (trash) workflows",
)
async def delete_workflows(request: DeleteRequest) -> Dict[str, Any]:
    deleted = await run_in_threadpool(_store().trash_workflow, request.workflowIds)
    payload = {"deleted": deleted}

    return payload


@router.get(
    "/configs",
    summary="Bulk-fetch latest configs by workflow ids",
)
async def get_configs(ids: str) -> Dict[str, Any]:
    workflow_ids = [workflow_id for workflow_id in ids.split(",") if workflow_id]
    configs = await run_in_threadpool(_store().get_configs, workflow_ids)
    payload = {"configs": {key: config_object(value) for key, value in configs.items()}}

    return payload


@router.get(
    "/versions",
    summary="List the version chain of a workflow, newest first",
)
async def list_versions(
    url: Optional[str] = None, id: Optional[str] = None
) -> Response:
    store = _store()
    row = await run_in_threadpool(store.get_workflow, url=url, workflow_id=id)
    if row is None:
        return _not_found_response()

    def _summaries(versions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        summaries = [
            {
                "id": version["id"],
                "name": version["name"],
                "createdAt": version["created_at"],
                "published": version["id"] == row["last_version_id"],
                "isLatest": version["id"] == row["latest_version_id"],
            }
            for version in versions
        ]

        return summaries

    versions = await run_in_threadpool(store.list_versions, workflow_id=row["id"])
    payload = {
        "workflowId": row["id"],
        "workflowUrl": row["url"],
        "versions": _summaries(versions),
    }

    return payload


@router.get(
    "/versions/{versionId}",
    summary="Fetch one stored version with its config",
)
async def get_version(versionId: str) -> Response:
    version = await run_in_threadpool(_store().get_version, versionId)
    if version is None:
        return _not_found_response()

    payload = _version_payload(version)

    return payload


@router.get(
    "/registry",
    summary="Blocks registry payload (blocks/describe equivalent)",
)
async def get_registry() -> Dict[str, Any]:
    payload = await run_in_threadpool(registry.get_registry_payload)

    return payload


@router.post(
    "/validate",
    summary="Validate a config; findings never produce a 4xx",
)
async def validate(request: ValidateRequest) -> Dict[str, Any]:
    result = _validation_payload(request.config)

    return result


@router.get(
    "/validate",
    summary="Validate a stored workflow's config (optional spec override)",
)
async def validate_stored(url: str, spec: Optional[str] = None) -> Response:
    if spec is not None:
        result = _validation_payload(spec)

        return result

    store = _store()
    row = await run_in_threadpool(store.get_workflow, url=url, workflow_id=None)
    if row is None:
        return _not_found_response()

    latest = await run_in_threadpool(store.get_spec, workflow_id=row["id"])
    if latest is None:
        result = {"errors": [], "warnings": []}
    else:
        result = _validation_payload(latest["config"])

    return result


@router.post(
    "/run",
    summary="Execute a specification through the workflows engine",
)
async def run_workflow(
    request: Request, body: RunRequest, background_tasks: BackgroundTasks
) -> Response:
    try:
        payload = await run_module.run_studio_workflow(
            request,
            specification=body.specification,
            inputs=body.inputs,
            api_key=body.api_key,
            background_tasks=background_tasks,
        )
    except Exception as error:  # noqa: BLE001 - surfaced as a single contract error
        response = JSONResponse(
            status_code=422,
            content={"errors": [{"code": "execution_error", "message": str(error)}]},
        )

        return response

    response = Response(
        content=orjson.dumps(payload, default=_orjson_default),
        media_type="application/json",
    )

    return response


def _orjson_default(value: Any) -> Any:
    if isinstance(value, (bytes, bytearray, memoryview)):
        return base64.b64encode(bytes(value)).decode("ascii")

    return value
