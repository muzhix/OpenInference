import json


def _spec(step_type="roboflow_core/image_blur@v1", output_name="out"):
    config = {
        "specification": {
            "version": "1.0",
            "inputs": [{"type": "WorkflowImage", "name": "image"}],
            "steps": [
                {
                    "type": step_type,
                    "name": "step",
                    "image": "$inputs.image",
                }
            ],
            "outputs": [
                {
                    "type": "JsonField",
                    "name": output_name,
                    "selector": "$steps.step.image",
                }
            ],
            "metadata": {"ui": {"nodes": {"$inputs": {"x": 0, "y": 0}}}},
        }
    }

    return config


def test_save_create_uses_defaults_and_seeds_starter_config(studio_client):
    response = studio_client.post("/api/wf/save", json={})

    assert response.status_code == 200, response.text
    workflow = response.json()["workflow"]
    assert workflow["url"] == "custom-workflow"
    assert workflow["name"] == "Custom Workflow"
    assert workflow["published"] is False
    assert workflow["hasUnpublishedChanges"] is True
    assert workflow["config"] == {
        "version": "1.0",
        "inputs": [{"type": "WorkflowImage", "name": "image"}],
        "steps": [],
        "outputs": [],
    }
    assert workflow["lastVersionConfig"] is None


def test_list_then_get_by_url_and_id(studio_client):
    created = studio_client.post("/api/wf/save", json={"name": "My Flow"}).json()

    listing = studio_client.get("/api/wf/list").json()
    assert [item["url"] for item in listing["workflows"]] == ["my-flow"]
    assert "config" not in listing["workflows"][0]

    by_url = studio_client.get("/api/wf/get?url=my-flow").json()["workflow"]
    by_id = studio_client.get("/api/wf/get?id=" + created["workflow"]["id"]).json()[
        "workflow"
    ]
    assert by_url["id"] == by_id["id"]
    assert by_url["createTime"] and by_url["updateTime"]
    assert by_url["owner"] == "local"


def test_get_missing_workflow_returns_404(studio_client):
    response = studio_client.get("/api/wf/get?url=nope")

    assert response.status_code == 404
    assert response.json() == {"error": "Workflow not found"}


def test_spec_endpoint_returns_latest_version(studio_client):
    created = studio_client.post("/api/wf/save", json={}).json()["workflow"]
    studio_client.post(
        "/api/wf/saveDraft", json={"workflowId": created["id"], "config": _spec()}
    )

    response = studio_client.get(
        "/api/wf/spec", params={"url": "custom-workflow", "preferDraft": "true"}
    )

    assert response.status_code == 200, response.text
    workflow_spec = response.json()["workflowSpec"]
    assert workflow_spec["workflowId"] == created["id"]
    assert workflow_spec["workflowUrl"] == "custom-workflow"
    assert workflow_spec["workspaceId"] == "local"
    assert workflow_spec["versionId"] is not None
    assert workflow_spec["config"]["steps"][0]["type"] == (
        "roboflow_core/image_blur@v1"
    )


def test_save_draft_appends_version_and_returns_cloud_shaped_payload(studio_client):
    created = studio_client.post("/api/wf/save", json={}).json()["workflow"]

    response = studio_client.post(
        "/api/wf/saveDraft",
        json={"workflowId": created["id"], "config": json.dumps(_spec())},
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["version"]["name"].startswith("Draft saved on ")
    assert payload["version"]["id"].isdigit()
    assert payload["version"]["config"]["version"] == "1.0"
    assert payload["workflow"]["config"]["steps"]


def test_save_draft_rejects_dangling_references_with_422(studio_client):
    created = studio_client.post("/api/wf/save", json={}).json()["workflow"]
    invalid = {
        "specification": {
            "version": "1.0",
            "inputs": [],
            "steps": [],
            "outputs": [
                {
                    "type": "JsonField",
                    "name": "out",
                    "selector": "$steps.ghost.output",
                }
            ],
        }
    }

    response = studio_client.post(
        "/api/wf/saveDraft", json={"workflowId": created["id"], "config": invalid}
    )

    assert response.status_code == 422
    error = response.json()["errors"][0]
    assert error["code"] == "dangling_reference"
    assert error["path"]
    assert error["message"]

    spec = studio_client.get("/api/wf/spec", params={"url": "custom-workflow"}).json()
    assert spec["workflowSpec"]["config"] == {
        "version": "1.0",
        "inputs": [{"type": "WorkflowImage", "name": "image"}],
        "steps": [],
        "outputs": [],
    }


def test_save_draft_on_unknown_workflow_returns_404(studio_client):
    response = studio_client.post(
        "/api/wf/saveDraft", json={"workflowId": "nope", "config": _spec()}
    )

    assert response.status_code == 404


def test_publish_then_draft_marks_unpublished_changes(studio_client):
    created = studio_client.post("/api/wf/save", json={}).json()["workflow"]
    studio_client.post(
        "/api/wf/saveDraft", json={"workflowId": created["id"], "config": _spec()}
    )

    published = studio_client.post(
        "/api/wf/save", json={"id": created["id"], "publish": True}
    ).json()["workflow"]

    assert published["published"] is True
    assert published["hasUnpublishedChanges"] is False
    assert published["lastVersionConfig"]["steps"]

    studio_client.post(
        "/api/wf/saveDraft",
        json={"workflowId": created["id"], "config": _spec(output_name="out2")},
    )
    after_draft = studio_client.get("/api/wf/get?id=" + created["id"]).json()[
        "workflow"
    ]

    assert after_draft["published"] is True
    assert after_draft["hasUnpublishedChanges"] is True
    assert after_draft["config"]["outputs"][0]["name"] == "out2"
    assert after_draft["lastVersionConfig"]["outputs"][0]["name"] == "out"


def test_save_duplicate_copies_config_with_deduped_name_and_url(studio_client):
    source = studio_client.post(
        "/api/wf/save", json={"name": "Flow", "url": "flow", "config": _spec()}
    ).json()["workflow"]

    duplicate = studio_client.post(
        "/api/wf/save", json={"template": "duplicate", "sourceId": source["id"]}
    ).json()["workflow"]

    assert duplicate["name"] == "Flow 2"
    assert duplicate["url"] == "flow-2"
    assert duplicate["config"]["steps"]
    assert duplicate["published"] is False


def test_save_rename_updates_name_and_url(studio_client):
    created = studio_client.post("/api/wf/save", json={"name": "Old"}).json()[
        "workflow"
    ]

    renamed = studio_client.post(
        "/api/wf/save", json={"id": created["id"], "name": "New", "url": "new"}
    ).json()["workflow"]

    assert renamed["name"] == "New"
    assert renamed["url"] == "new"
    assert studio_client.get("/api/wf/get?url=new").status_code == 200


def test_save_rename_to_taken_url_returns_422(studio_client):
    studio_client.post("/api/wf/save", json={"name": "a", "url": "a"})
    second = studio_client.post("/api/wf/save", json={"name": "b", "url": "b"}).json()[
        "workflow"
    ]

    response = studio_client.post("/api/wf/save", json={"id": second["id"], "url": "a"})

    assert response.status_code == 422
    assert response.json()["errors"][0]["code"] == "url_taken"


def test_save_create_with_explicit_taken_url_returns_422(studio_client):
    studio_client.post("/api/wf/save", json={"name": "a", "url": "a"})

    response = studio_client.post("/api/wf/save", json={"name": "b", "url": "a"})

    assert response.status_code == 422
    assert response.json()["errors"][0]["code"] == "url_taken"


def test_delete_soft_deletes_and_ignores_unknown_ids(studio_client):
    created = studio_client.post("/api/wf/save", json={}).json()["workflow"]

    response = studio_client.post(
        "/api/wf/delete", json={"workflowIds": [created["id"], "unknown"]}
    )

    assert response.status_code == 200
    assert response.json() == {"deleted": [created["id"]]}
    assert studio_client.get("/api/wf/get?url=custom-workflow").status_code == 404
    assert studio_client.get("/api/wf/list").json()["workflows"] == []


def test_configs_returns_latest_config_objects(studio_client):
    first = studio_client.post(
        "/api/wf/save", json={"name": "a", "url": "a", "config": _spec()}
    ).json()["workflow"]
    second = studio_client.post("/api/wf/save", json={"name": "b", "url": "b"}).json()[
        "workflow"
    ]

    response = studio_client.get(
        "/api/wf/configs",
        params={"ids": ",".join([first["id"], second["id"], "nope"])},
    )

    assert response.status_code == 200
    configs = response.json()["configs"]
    assert set(configs) == {first["id"], second["id"]}
    assert configs[first["id"]]["version"] == "1.0"
    assert configs[first["id"]]["steps"]
    assert configs[second["id"]]["steps"] == []


def test_validate_returns_findings_without_client_errors(studio_client):
    invalid = {
        "specification": {
            "version": "1.0",
            "inputs": [],
            "steps": [],
            "outputs": [
                {
                    "type": "JsonField",
                    "name": "out",
                    "selector": "$inputs.missing",
                }
            ],
        }
    }

    response = studio_client.post("/api/wf/validate", json={"config": invalid})

    assert response.status_code == 200
    assert response.json()["errors"][0]["code"] == "dangling_reference"
    assert response.json()["warnings"] == []


def test_validate_accepts_json_string_config(studio_client):
    response = studio_client.post(
        "/api/wf/validate", json={"config": json.dumps(_spec())}
    )

    assert response.status_code == 200
    assert response.json() == {"errors": [], "warnings": []}


def test_validate_reports_unparseable_config_as_invalid_spec(studio_client):
    response = studio_client.post("/api/wf/validate", json={"config": "{not json"})

    assert response.status_code == 200
    assert response.json()["errors"][0]["code"] == "invalid_spec"


def test_validate_stored_workflow_via_get(studio_client):
    studio_client.post(
        "/api/wf/save", json={"name": "a", "url": "a", "config": _spec()}
    )
    invalid = {
        "specification": {
            "version": "1.0",
            "inputs": [],
            "steps": [],
            "outputs": [
                {
                    "type": "JsonField",
                    "name": "out",
                    "selector": "$steps.ghost.output",
                }
            ],
        }
    }

    stored = studio_client.get("/api/wf/validate", params={"url": "a"})
    override = studio_client.get(
        "/api/wf/validate", params={"url": "a", "spec": json.dumps(invalid)}
    )
    missing = studio_client.get("/api/wf/validate", params={"url": "nope"})

    assert stored.status_code == 200
    assert stored.json()["errors"] == []
    assert override.json()["errors"][0]["code"] == "dangling_reference"
    assert missing.status_code == 404


def test_versions_lists_chain_and_single_version(studio_client):
    created = studio_client.post("/api/wf/save", json={}).json()["workflow"]
    studio_client.post(
        "/api/wf/saveDraft", json={"workflowId": created["id"], "config": _spec()}
    )
    studio_client.post(
        "/api/wf/saveDraft",
        json={"workflowId": created["id"], "config": _spec(output_name="out2")},
    )

    listing = studio_client.get(
        "/api/wf/versions", params={"url": "custom-workflow"}
    ).json()

    assert listing["workflowId"] == created["id"]
    assert len(listing["versions"]) == 3
    assert listing["versions"][0]["isLatest"] is True
    assert all(not version["published"] for version in listing["versions"])

    single = studio_client.get(
        "/api/wf/versions/" + listing["versions"][0]["id"]
    ).json()
    assert single["config"]["outputs"][0]["name"] == "out2"

    missing = studio_client.get("/api/wf/versions/not-a-version")

    assert missing.status_code == 404
