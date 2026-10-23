import base64
import io

from inference_server.workflow_studio.run import (
    normalize_run_inputs,
    prepare_specification,
)


def _png_b64() -> str:
    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (16, 12), color=(30, 60, 90)).save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode()

    return encoded


def test_prepare_specification_strips_metadata():
    specification = {
        "version": "1.0",
        "inputs": [{"type": "WorkflowImage", "name": "image"}],
        "steps": [],
        "outputs": [],
        "metadata": {"ui": {"nodes": {"$inputs": {"x": 1, "y": 2}}}},
    }

    prepared = prepare_specification(specification)

    assert "metadata" not in prepared
    assert prepared["inputs"] == specification["inputs"]
    assert specification["metadata"]  # original is not mutated


def test_prepare_specification_unwraps_cloud_wrapper():
    specification = {
        "specification": {
            "version": "1.0",
            "inputs": [],
            "steps": [],
            "outputs": [],
        }
    }

    prepared = prepare_specification(specification)

    assert prepared["version"] == "1.0"


def test_prepare_specification_converts_name_keyed_steps_to_list():
    specification = {
        "version": "1.0",
        "inputs": [],
        "steps": {
            "blur": {"type": "roboflow_core/image_blur@v1", "image": "$inputs.image"},
        },
        "outputs": [],
    }

    prepared = prepare_specification(specification)

    assert prepared["steps"] == [
        {
            "type": "roboflow_core/image_blur@v1",
            "image": "$inputs.image",
            "name": "blur",
        }
    ]


def test_prepare_specification_rewrites_all_properties_outputs():
    specification = {
        "version": "1.0",
        "inputs": [],
        "steps": [
            {
                "type": "test/sink@v1",
                "name": "sink",
                "input": "$steps.blur.all_properties",
            }
        ],
        "outputs": [
            {
                "type": "JsonField",
                "name": "out",
                "selector": "$steps.blur.all_properties",
            },
            {
                "type": "JsonField",
                "name": "image",
                "selector": "$steps.blur.image",
            },
        ],
    }

    prepared = prepare_specification(specification)

    assert prepared["outputs"][0]["selector"] == "$steps.blur.*"
    assert prepared["outputs"][1]["selector"] == "$steps.blur.image"
    assert prepared["steps"][0]["input"] == "$steps.blur.all_properties"
    assert specification["outputs"][0]["selector"] == "$steps.blur.all_properties"


def test_normalize_run_inputs_strips_frontend_only_flags():
    inputs = {
        "image": {
            "type": "base64",
            "value": "abc",
            "validUrl": True,
        },
        "limit": 3,
    }

    normalized = normalize_run_inputs(inputs)

    assert normalized["image"] == {"type": "base64", "value": "abc"}
    assert normalized["limit"] == 3
    assert inputs["image"]["validUrl"] is True  # original is not mutated


def test_normalize_run_inputs_keeps_url_descriptors_and_plain_values():
    inputs = {
        "image": {"type": "url", "value": "https://example.com/a.png"},
        "nested": {"deep": [{"type": "base64", "value": "x", "validUrl": False}]},
    }

    normalized = normalize_run_inputs(inputs)

    assert normalized["image"] == {"type": "url", "value": "https://example.com/a.png"}
    assert normalized["nested"] == inputs["nested"]


def test_run_endpoint_executes_image_blur_workflow(legacy_client, studio_db_path):
    from tests.unit_tests.legacy.conftest import FakeGateway

    client = legacy_client(FakeGateway())
    specification = {
        "version": "1.0",
        "inputs": [{"type": "WorkflowImage", "name": "image"}],
        "steps": [
            {
                "type": "roboflow_core/image_blur@v1",
                "name": "blur",
                "image": "$inputs.image",
            }
        ],
        "outputs": [
            {
                "type": "JsonField",
                "name": "blur_output",
                "selector": "$steps.blur.image",
            }
        ],
        "metadata": {"ui": {"nodes": {"$inputs": {"x": 0, "y": 0}}}},
    }

    response = client.post(
        "/api/wf/run",
        json={
            "specification": specification,
            "inputs": {
                "image": {"type": "base64", "value": _png_b64(), "validUrl": False}
            },
        },
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert list(payload["outputs"][0]) == ["blur_output"]
    assert payload["profiler_trace"] == []
    blur_output = payload["outputs"][0]["blur_output"]
    assert blur_output["type"] == "base64"

    from PIL import Image

    decoded = Image.open(io.BytesIO(base64.b64decode(blur_output["value"])))

    assert decoded.size == (16, 12)


def test_run_endpoint_maps_engine_errors_to_422(legacy_client, studio_db_path):
    from tests.unit_tests.legacy.conftest import FakeGateway

    client = legacy_client(FakeGateway())
    broken_specification = {
        "version": "1.0",
        "inputs": [],
        "steps": [{"type": "not/a_block@v1", "name": "step"}],
        "outputs": [],
    }

    response = client.post(
        "/api/wf/run",
        json={"specification": broken_specification, "inputs": {}},
    )

    assert response.status_code == 422, response.text
    error = response.json()["errors"][0]
    assert error["code"] == "execution_error"
    assert error["message"]
