"""Roboflow-compatible external model metadata endpoints."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse

from inferegistry.store import RegistryStore, decode_model_id_from_path

router = APIRouter()


def _store(request: Request) -> RegistryStore:
    return request.app.state.store


@router.get("/models/v1/external/stat")
def external_stat(
    request: Request,
    modelId: str = Query(..., alias="modelId"),
) -> dict:
    """Return task/architecture metadata for a model id."""
    try:
        return _store(request).build_stat_response(modelId)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/models/v1/external/weights")
def external_weights(
    request: Request,
    modelId: str = Query(..., alias="modelId"),
    pageSize: Optional[int] = Query(None, alias="pageSize"),
    startAfter: Optional[str] = Query(None, alias="startAfter"),
) -> dict:
    """Return paginated model packages with local download URLs."""
    try:
        return _store(request).build_weights_response(
            modelId,
            page_size=pageSize,
            start_after=startAfter,
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/artifacts/{model_id}/{package_id}/{file_handle:path}")
def download_artifact(
    request: Request,
    model_id: str,
    package_id: str,
    file_handle: str,
) -> FileResponse:
    """Serve a package file; path traversal is rejected by the store."""
    decoded_model_id = decode_model_id_from_path(model_id)
    try:
        path = _store(request).resolve_artifact_path(
            decoded_model_id,
            package_id,
            file_handle,
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return FileResponse(path)
