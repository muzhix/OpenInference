import json

import pytest

from inference_server.workflow_studio.store import (
    WorkflowNotFoundError,
    WorkflowStudioStore,
    draft_version_name,
    slugify,
)


def _config(payload: dict) -> str:
    config = json.dumps(payload)

    return config


def test_create_inserts_initial_version_and_slugifies_name(tmp_path):
    store = WorkflowStudioStore(tmp_path / "ws.db")

    row = store.create_workflow(
        name="My Flow!", config=_config({"specification": {"version": "1.0"}})
    )

    assert row["url"] == "my-flow"
    assert row["deleted"] == 0
    assert row["owner"] == "local"
    assert row["created_by_ai"] == 0
    assert row["latest_version_id"] is not None
    assert row["last_version_id"] is None
    spec = store.get_spec(workflow_id=row["id"])
    assert spec["config"] == _config({"specification": {"version": "1.0"}})


def test_create_dedupes_slugs_with_numeric_suffixes(tmp_path):
    store = WorkflowStudioStore(tmp_path / "ws.db")

    first = store.create_workflow(name="Custom Workflow")
    second = store.create_workflow(name="Custom Workflow")
    third = store.create_workflow(name="Custom Workflow")

    assert [first["url"], second["url"], third["url"]] == [
        "custom-workflow",
        "custom-workflow-2",
        "custom-workflow-3",
    ]


def test_draft_publish_version_chain_ordering(tmp_path):
    store = WorkflowStudioStore(tmp_path / "ws.db")
    row = store.create_workflow(name="wf", config=_config({"v": 0}))

    first_draft = store.save_draft(workflow_id=row["id"], config=_config({"v": 1}))
    second_draft = store.save_draft(workflow_id=row["id"], config=_config({"v": 2}))

    assert first_draft["id"] != second_draft["id"]
    assert first_draft["id"].isdigit()
    assert int(second_draft["id"]) >= int(first_draft["id"])

    latest = store.get_spec(workflow_id=row["id"])
    assert latest["id"] == second_draft["id"]
    assert json.loads(latest["config"]) == {"v": 2}

    published = store.publish(workflow_id=row["id"])
    assert published["last_version_id"] == second_draft["id"]

    store.save_draft(workflow_id=row["id"], config=_config({"v": 3}))
    still_latest = store.get_spec(workflow_id=row["id"])
    assert json.loads(still_latest["config"]) == {"v": 3}


def test_save_draft_bumps_updated_at_and_clears_edited_by_ai(tmp_path):
    import sqlite3

    store = WorkflowStudioStore(tmp_path / "ws.db")
    row = store.create_workflow(name="wf", config=_config({"v": 0}))

    with sqlite3.connect(tmp_path / "ws.db") as connection:
        connection.execute(
            "UPDATE workflows SET edited_by_ai = 1 WHERE id = ?", (row["id"],)
        )

    store.save_draft(workflow_id=row["id"], config=_config({"v": 1}))
    refreshed = store.get_workflow(workflow_id=row["id"])

    assert refreshed["edited_by_ai"] == 0
    assert refreshed["updated_at"] >= row["updated_at"]


def test_rename_workflow_updates_name_and_url(tmp_path):
    store = WorkflowStudioStore(tmp_path / "ws.db")
    row = store.create_workflow(name="Old Name")

    renamed = store.rename_workflow(
        workflow_id=row["id"], name="New Name", url="new-name"
    )

    assert renamed["name"] == "New Name"
    assert renamed["url"] == "new-name"
    assert store.get_workflow(url="new-name")["id"] == row["id"]


def test_rename_to_taken_url_raises(tmp_path):
    store = WorkflowStudioStore(tmp_path / "ws.db")
    first = store.create_workflow(name="a", url="a")
    second = store.create_workflow(name="b", url="b")

    with pytest.raises(ValueError):
        store.rename_workflow(workflow_id=second["id"], url="a")

    assert store.get_workflow(workflow_id=first["id"])["url"] == "a"


def test_duplicate_copies_latest_config_with_deduped_name_and_url(tmp_path):
    store = WorkflowStudioStore(tmp_path / "ws.db")
    source = store.create_workflow(name="Flow", url="flow", config=_config({"v": 1}))
    store.save_draft(workflow_id=source["id"], config=_config({"v": 2}))

    duplicate = store.duplicate_workflow(source_id=source["id"])

    assert duplicate["name"] == "Flow 2"
    assert duplicate["url"] == "flow-2"
    assert duplicate["last_version_id"] is None
    spec = store.get_spec(workflow_id=duplicate["id"])
    assert json.loads(spec["config"]) == {"v": 2}


def test_trash_workflow_excludes_from_listing(tmp_path):
    store = WorkflowStudioStore(tmp_path / "ws.db")
    keep = store.create_workflow(name="keep")
    drop = store.create_workflow(name="drop")

    deleted = store.trash_workflow([drop["id"], "unknown-id"])

    assert deleted == [drop["id"]]
    assert [row["url"] for row in store.list_workflows()] == ["keep"]
    assert store.get_workflow(workflow_id=drop["id"]) is None


def test_get_configs_omits_missing_ids_and_versionless_workflows(tmp_path):
    store = WorkflowStudioStore(tmp_path / "ws.db")
    with_config = store.create_workflow(name="a", config=_config({"v": 1}))
    without_config = store.create_workflow(name="b")

    configs = store.get_configs([with_config["id"], without_config["id"], "nope"])

    assert list(configs) == [with_config["id"]]
    assert json.loads(configs[with_config["id"]]) == {"v": 1}


def test_unknown_workflow_raises_workflow_not_found(tmp_path):
    store = WorkflowStudioStore(tmp_path / "ws.db")

    with pytest.raises(WorkflowNotFoundError):
        store.save_draft(workflow_id="nope", config=_config({}))
    with pytest.raises(WorkflowNotFoundError):
        store.publish(workflow_id="nope")


def test_slugify_collapses_non_alphanumeric_runs():
    assert slugify("My  Fancy -- Workflow!!") == "my-fancy-workflow"
    assert slugify("全方位  camera") == "camera"


def test_draft_version_name_matches_cloud_format():
    from datetime import datetime

    label = draft_version_name(datetime(2026, 10, 21, 12, 0, 0))

    assert label == "Draft saved on Oct 21, 2026"
