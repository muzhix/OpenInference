"""Admin register / list / delete / validate API."""

from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field

from inferegistry.store import RegistryStore

router = APIRouter(prefix="/v1/models")


class RegisterBody(BaseModel):
    model_id: str = Field(alias="modelId")
    package_id: str = Field(default="default", alias="packageId")

    model_config = {"populate_by_name": True}


class ValidateBody(BaseModel):
    model_id: str = Field(alias="modelId")
    package_id: str = Field(default="default", alias="packageId")

    model_config = {"populate_by_name": True}


def _store(request: Request) -> RegistryStore:
    return request.app.state.store


def require_admin_token(
    authorization: Optional[str] = Header(default=None),
) -> None:
    token = os.getenv("INFERGRAPH_REGISTRY_TOKEN", "").strip()
    if not token:
        return
    expected = f"Bearer {token}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Invalid registry token")


@router.get("")
def list_models(request: Request) -> dict:
    return {"models": _store(request).list_models()}


@router.post("", dependencies=[Depends(require_admin_token)])
def register_model(request: Request, body: RegisterBody) -> dict:
    try:
        entry = _store(request).register_package(
            model_id=body.model_id,
            package_id=body.package_id,
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return entry


@router.post("/validate", dependencies=[Depends(require_admin_token)])
def validate_model(request: Request, body: ValidateBody) -> dict:
    try:
        return _store(request).validate_package(
            model_id=body.model_id,
            package_id=body.package_id,
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.delete("/{model_id:path}", dependencies=[Depends(require_admin_token)])
def delete_model(
    request: Request,
    model_id: str,
    delete_files: bool = False,
) -> dict:
    deleted = _store(request).delete_model(model_id, delete_files=delete_files)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Unknown model `{model_id}`")
    return {"deleted": True, "modelId": model_id}
