"""SQLite version-chain store for Workflow Studio.

Uses the standard-library ``sqlite3`` module (repository convention: no
SQLAlchemy). Each method opens a short-lived connection with WAL enabled and
re-applies the idempotent schema, so the store is safe to construct per
request and across processes.
"""

from __future__ import annotations

import re
import sqlite3
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional

_SCHEMA = """
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  owner TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by_ai INTEGER NOT NULL DEFAULT 0,
  edited_by_ai INTEGER NOT NULL DEFAULT 0,
  last_version_id TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  trashed_at TEXT
);
CREATE TABLE IF NOT EXISTS versions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  name TEXT NOT NULL,
  config TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_versions_workflow_id ON versions(workflow_id);
"""


class WorkflowNotFoundError(LookupError):
    """Raised when a workflow id or url is unknown to the store."""


class WorkflowUrlTakenError(ValueError):
    """Raised when a requested workflow url is already in use."""


def slugify(name: str) -> str:
    """Convert a workflow name into a url slug.

    Args:
        name: Display name of the workflow.

    Returns:
        Lowercase slug with non-alphanumeric runs collapsed to single dashes.
    """
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")

    return slug or "workflow"


def draft_version_name(now: Optional[datetime] = None) -> str:
    """Return the human-facing label for a saved draft version.

    Args:
        now: Optional clock override, local time.

    Returns:
        Label like ``Draft saved on Oct 21, 2026``.
    """
    moment = now or datetime.now()
    label = f"Draft saved on {moment.strftime('%b %d, %Y')}"

    return label


class WorkflowStudioStore:
    """Data-access layer over the ``workflows``/``versions`` tables."""

    def __init__(self, db_path: Path) -> None:
        self.db_path = Path(db_path)

    # -- connection handling ------------------------------------------------

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.db_path, timeout=5)
        connection.row_factory = sqlite3.Row
        try:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.executescript(_SCHEMA)
            yield connection
            connection.commit()
        except BaseException:
            connection.rollback()
            raise
        finally:
            connection.close()

    def init_schema(self) -> None:
        """Create the tables if they do not exist yet."""
        with self._connect():
            pass

    # -- workflow lifecycle --------------------------------------------------

    def create_workflow(
        self,
        *,
        name: str,
        url: Optional[str] = None,
        config: Optional[str] = None,
        owner: str = "local",
        created_by_ai: bool = False,
    ) -> Dict[str, Any]:
        """Create a workflow row plus its initial version.

        Args:
            name: Display name; also seeds the slug when ``url`` is omitted.
            url: Explicit slug; must be free.
            config: Canonical config string stored as the first version.
            owner: Owner label recorded on the row.
            created_by_ai: Whether the workflow was initially created by AI.

        Returns:
            The stored workflow row (with ``latest_version_id``) as a dict.

        Raises:
            WorkflowUrlTakenError: If an explicit ``url`` is already in use.
        """
        with self._connect() as connection:
            resolved_url = self._resolve_url(
                connection=connection, explicit_url=url, name=name
            )
            created = self._create_row(
                connection=connection,
                name=name,
                url=resolved_url,
                owner=owner,
                created_by_ai=created_by_ai,
            )
            if config is not None:
                self._insert_version(
                    connection=connection,
                    workflow_id=created["id"],
                    config=config,
                )

        row = self.get_workflow(workflow_id=created["id"])

        return row

    def duplicate_workflow(
        self, *, source_id: str, name: Optional[str] = None, url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Duplicate a workflow, copying its latest config as a new version chain.

        Args:
            source_id: Id of the workflow to copy from.
            name: Optional explicit name; defaults to ``<source name> 2`` (deduped).
            url: Optional explicit slug; defaults to ``<source url>-2`` (deduped).

        Returns:
            The newly created workflow row as a dict.

        Raises:
            WorkflowNotFoundError: If ``source_id`` is unknown.
        """
        with self._connect() as connection:
            source = self._get_workflow_row(
                connection=connection, url=None, workflow_id=source_id
            )
            if source is None:
                raise WorkflowNotFoundError(source_id)

            latest = self._latest_version(connection=connection, workflow_id=source_id)
            resolved_name = name or self._dedupe_name(
                connection=connection, source_name=source["name"]
            )
            resolved_url = url or self._dedupe_url(
                connection=connection, source_url=source["url"]
            )
            new_workflow = self._create_row(
                connection=connection,
                name=resolved_name,
                url=resolved_url,
                owner=source["owner"],
                created_by_ai=False,
            )
            if latest is not None:
                self._insert_version(
                    connection=connection,
                    workflow_id=new_workflow["id"],
                    config=latest["config"],
                )

        row = self.get_workflow(workflow_id=new_workflow["id"])

        return row

    def rename_workflow(
        self, *, workflow_id: str, name: Optional[str] = None, url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Rename a workflow and/or change its slug.

        Args:
            workflow_id: Id of the workflow to update.
            name: New display name; omitted values are left unchanged.
            url: New slug; must be free (or already owned by this workflow).

        Returns:
            The updated workflow row as a dict.

        Raises:
            WorkflowNotFoundError: If the workflow is unknown.
            WorkflowUrlTakenError: If the target ``url`` is owned by another
                workflow.
        """
        with self._connect() as connection:
            row = self._require_workflow(
                connection=connection, url=None, workflow_id=workflow_id
            )
            if url is not None and url != row["url"]:
                clash = self._get_workflow_row(
                    connection=connection, url=url, workflow_id=None
                )
                if clash is not None:
                    raise WorkflowUrlTakenError(url)

            assignments = []
            values: List[Any] = []
            if name is not None:
                assignments.append("name = ?")
                values.append(name)
            if url is not None:
                assignments.append("url = ?")
                values.append(url)
            if assignments:
                assignments.append("updated_at = ?")
                values.append(_utc_now_iso())
                values.append(workflow_id)
                connection.execute(
                    f"UPDATE workflows SET {', '.join(assignments)} WHERE id = ?",
                    values,
                )

        updated = self.get_workflow(workflow_id=workflow_id)

        return updated

    def trash_workflow(self, workflow_ids: List[str]) -> List[str]:
        """Soft-delete workflows (they stop appearing in listings).

        Args:
            workflow_ids: Ids requested for deletion; unknown ids are ignored.

        Returns:
            Ids that were actually trashed by this call.
        """
        trashed: List[str] = []
        with self._connect() as connection:
            for workflow_id in workflow_ids:
                cursor = connection.execute(
                    "UPDATE workflows SET deleted = 1, trashed_at = ? "
                    "WHERE id = ? AND deleted = 0",
                    (_utc_now_iso(), workflow_id),
                )
                if cursor.rowcount:
                    trashed.append(workflow_id)

        return trashed

    def list_workflows(self) -> List[Dict[str, Any]]:
        """Return all non-deleted workflows, most recently updated first."""
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM workflows WHERE deleted = 0 ORDER BY updated_at DESC"
            ).fetchall()
            workflows = [
                self._with_latest_version_id(connection=connection, row=row)
                for row in rows
            ]

        return workflows

    def get_workflow(
        self, *, url: Optional[str] = None, workflow_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Return one workflow row (including ``latest_version_id``) or None."""
        with self._connect() as connection:
            row = self._get_workflow_row(
                connection=connection, url=url, workflow_id=workflow_id
            )
            if row is None:
                return None

            workflow = self._with_latest_version_id(connection=connection, row=row)

        return workflow

    def get_spec(self, *, workflow_id: str) -> Optional[Dict[str, Any]]:
        """Return the latest version of a workflow.

        Args:
            workflow_id: Id of the workflow.

        Returns:
            ``{"version_id": str, "config": str, "name": str, "created_at": str}``
            for the newest version, or None when the workflow has no versions.
        """
        with self._connect() as connection:
            latest = self._latest_version(
                connection=connection, workflow_id=workflow_id
            )

        return dict(latest) if latest is not None else None

    def save_draft(self, *, workflow_id: str, config: str) -> Dict[str, Any]:
        """Append a new draft version and mark the workflow manually edited.

        Args:
            workflow_id: Id of the workflow.
            config: Canonical config string to store.

        Returns:
            The created version row as a dict.

        Raises:
            WorkflowNotFoundError: If the workflow is unknown or trashed.
        """
        with self._connect() as connection:
            self._require_workflow(
                connection=connection, url=None, workflow_id=workflow_id
            )
            version = self._insert_version(
                connection=connection, workflow_id=workflow_id, config=config
            )
            connection.execute(
                "UPDATE workflows SET updated_at = ?, edited_by_ai = 0 WHERE id = ?",
                (_utc_now_iso(), workflow_id),
            )

        return version

    def publish(self, *, workflow_id: str) -> Dict[str, Any]:
        """Point ``last_version_id`` at the newest version.

        Args:
            workflow_id: Id of the workflow to publish.

        Returns:
            The updated workflow row as a dict.

        Raises:
            WorkflowNotFoundError: If the workflow is unknown.
        """
        with self._connect() as connection:
            self._require_workflow(
                connection=connection, url=None, workflow_id=workflow_id
            )
            latest = self._latest_version(
                connection=connection, workflow_id=workflow_id
            )
            if latest is not None:
                connection.execute(
                    "UPDATE workflows SET last_version_id = ?, updated_at = ? "
                    "WHERE id = ?",
                    (latest["id"], _utc_now_iso(), workflow_id),
                )

        row = self.get_workflow(workflow_id=workflow_id)

        return row

    def get_configs(self, workflow_ids: List[str]) -> Dict[str, str]:
        """Return the latest config string for each known workflow id.

        Args:
            workflow_ids: Workflow ids to look up.

        Returns:
            Mapping ``workflow id -> config JSON string``; missing ids and
            workflows without versions are omitted.
        """
        configs: Dict[str, str] = {}
        with self._connect() as connection:
            for workflow_id in workflow_ids:
                latest = self._latest_version(
                    connection=connection, workflow_id=workflow_id
                )
                if latest is not None:
                    configs[workflow_id] = latest["config"]

        return configs

    def get_version(self, version_id: str) -> Optional[Dict[str, Any]]:
        """Return one version row by id, or None."""
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM versions WHERE id = ?", (version_id,)
            ).fetchone()

        return dict(row) if row is not None else None

    def list_versions(self, *, workflow_id: str) -> List[Dict[str, Any]]:
        """Return all versions of a workflow, newest first."""
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM versions WHERE workflow_id = ? ORDER BY id DESC",
                (workflow_id,),
            ).fetchall()

        return [dict(row) for row in rows]

    # -- internals -----------------------------------------------------------

    def _resolve_url(
        self, *, connection: sqlite3.Connection, explicit_url: Optional[str], name: str
    ) -> str:
        if explicit_url is not None:
            clash = self._get_workflow_row(
                connection=connection, url=explicit_url, workflow_id=None
            )
            if clash is not None:
                raise WorkflowUrlTakenError(explicit_url)

            return explicit_url

        url = self._first_free_url(connection=connection, base=slugify(name))

        return url

    def _dedupe_name(self, *, connection: sqlite3.Connection, source_name: str) -> str:
        for counter in range(2, 1000):
            candidate = f"{source_name} {counter}"
            taken = connection.execute(
                "SELECT 1 FROM workflows WHERE name = ? AND deleted = 0",
                (candidate,),
            ).fetchone()
            if taken is None:
                return candidate

        return f"{source_name} {uuid.uuid4().hex[:6]}"

    def _dedupe_url(self, *, connection: sqlite3.Connection, source_url: str) -> str:
        for counter in range(2, 1000):
            candidate = f"{source_url}-{counter}"
            taken = connection.execute(
                "SELECT 1 FROM workflows WHERE url = ?", (candidate,)
            ).fetchone()
            if taken is None:
                return candidate

        return f"{source_url}-{uuid.uuid4().hex[:6]}"

    def _first_free_url(self, *, connection: sqlite3.Connection, base: str) -> str:
        candidates = [base] + [f"{base}-{counter}" for counter in range(2, 1000)]
        for candidate in candidates:
            taken = connection.execute(
                "SELECT 1 FROM workflows WHERE url = ?", (candidate,)
            ).fetchone()
            if taken is None:
                return candidate

        return f"{base}-{uuid.uuid4().hex[:6]}"

    def _create_row(
        self,
        *,
        connection: sqlite3.Connection,
        name: str,
        url: str,
        owner: str,
        created_by_ai: bool,
    ) -> Dict[str, Any]:
        now = _utc_now_iso()
        workflow_id = uuid.uuid4().hex
        connection.execute(
            "INSERT INTO workflows (id, name, url, owner, created_at, "
            "updated_at, created_by_ai) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (workflow_id, name, url, owner, now, now, int(created_by_ai)),
        )

        row = {
            "id": workflow_id,
            "name": name,
            "url": url,
            "owner": owner,
            "created_at": now,
            "updated_at": now,
            "created_by_ai": int(created_by_ai),
            "edited_by_ai": 0,
            "last_version_id": None,
            "deleted": 0,
            "trashed_at": None,
            "latest_version_id": None,
        }

        return row

    def _insert_version(
        self, *, connection: sqlite3.Connection, workflow_id: str, config: str
    ) -> Dict[str, Any]:
        version_id = _new_version_id(connection=connection)
        created_at = _utc_now_iso()
        label = draft_version_name()
        connection.execute(
            "INSERT INTO versions (id, workflow_id, name, config, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (version_id, workflow_id, label, config, created_at),
        )

        version = {
            "id": version_id,
            "workflow_id": workflow_id,
            "name": label,
            "config": config,
            "created_at": created_at,
        }

        return version

    def _get_workflow_row(
        self,
        *,
        connection: sqlite3.Connection,
        url: Optional[str],
        workflow_id: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        if url is not None:
            row = connection.execute(
                "SELECT * FROM workflows WHERE url = ? AND deleted = 0", (url,)
            ).fetchone()
        elif workflow_id is not None:
            row = connection.execute(
                "SELECT * FROM workflows WHERE id = ? AND deleted = 0", (workflow_id,)
            ).fetchone()
        else:
            row = None

        return dict(row) if row is not None else None

    def _require_workflow(
        self,
        *,
        connection: sqlite3.Connection,
        url: Optional[str],
        workflow_id: Optional[str],
    ) -> Dict[str, Any]:
        row = self._get_workflow_row(
            connection=connection, url=url, workflow_id=workflow_id
        )
        if row is None:
            raise WorkflowNotFoundError(url or workflow_id or "")

        return row

    def _latest_version(
        self, *, connection: sqlite3.Connection, workflow_id: str
    ) -> Optional[Dict[str, Any]]:
        row = connection.execute(
            "SELECT * FROM versions WHERE workflow_id = ? "
            "ORDER BY rowid DESC LIMIT 1",
            (workflow_id,),
        ).fetchone()

        return dict(row) if row is not None else None

    def _with_latest_version_id(
        self, *, connection: sqlite3.Connection, row: Dict[str, Any]
    ) -> Dict[str, Any]:
        workflow = dict(row)
        latest = self._latest_version(connection=connection, workflow_id=row["id"])
        workflow["latest_version_id"] = latest["id"] if latest is not None else None

        return workflow


def _utc_now_iso() -> str:
    moment = datetime.now(timezone.utc).isoformat()

    return moment


def _new_version_id(*, connection: sqlite3.Connection) -> str:
    candidate = str(int(time.time() * 1000))
    while connection.execute(
        "SELECT 1 FROM versions WHERE id = ?", (candidate,)
    ).fetchone():
        candidate = str(int(candidate) + 1)

    return candidate
