def test_registry_describes_local_blocks(studio_client):
    response = studio_client.get("/api/wf/registry")

    assert response.status_code == 200, response.text
    payload = response.json()

    assert len(payload["blocks"]) >= 240
    assert isinstance(payload["declared_kinds"], list)
    assert payload["declared_kinds"]
    assert isinstance(payload["kinds_connections"], dict)
    assert payload["kinds_connections"]

    first_block = payload["blocks"][0]
    assert first_block["manifest_type_identifier"]
    assert "block_schema" in first_block

    blur_types = [
        block["manifest_type_identifier"]
        for block in payload["blocks"]
        if block["manifest_type_identifier"] == "roboflow_core/image_blur@v1"
    ]
    assert blur_types == ["roboflow_core/image_blur@v1"]
