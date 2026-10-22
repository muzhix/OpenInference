"""Optional static mount of the Workflow Studio editor SPA."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

_STUDIO_MOUNT_PATH = "/studio"


class SPAStaticFiles(StaticFiles):
    """Static files serving with client-side routing fallback to index.html.

    Starlette >= 0.33 signals missing files by raising ``HTTPException(404)``;
    older versions return a 404 response. Both shapes fall back to the SPA
    entrypoint so that client-side routes like ``/studio/workflows`` resolve.
    """

    async def get_response(self, path: str, scope):
        try:
            response = await super().get_response(path, scope)
        except StarletteHTTPException as error:
            if error.status_code != 404:
                raise

            return await super().get_response("", scope)

        if response.status_code == 404:
            response = await super().get_response("", scope)

        return response


def studio_dist_directory() -> Path:
    """Return the directory holding the built editor assets.

    Prefers the ``WORKFLOW_STUDIO_DIST`` environment variable, falling back to
    ``workflow_studio/dist`` at the repository root (three levels above this
    file: ``workflow_studio/`` -> ``inference_server/`` -> ``inference_server/``
    -> repository root).

    Returns:
        Path to the candidate dist directory (may not exist).
    """
    override = os.environ.get("WORKFLOW_STUDIO_DIST")
    if override:
        return Path(override)

    repo_root = Path(__file__).resolve().parents[3]
    dist_directory = repo_root / "workflow_studio" / "dist"

    return dist_directory


def mount_workflow_studio(app: FastAPI) -> bool:
    """Mount the editor SPA at ``/studio`` when a build is present.

    Args:
        app: FastAPI application; must be called before any ``/`` static mount
            that would otherwise shadow the route.

    Returns:
        True when the mount was installed, False when no dist exists.
    """
    dist_directory = studio_dist_directory()
    if not dist_directory.is_dir():
        return False

    app.mount(
        _STUDIO_MOUNT_PATH,
        SPAStaticFiles(directory=dist_directory, html=True),
        name="workflow_studio",
    )

    return True
