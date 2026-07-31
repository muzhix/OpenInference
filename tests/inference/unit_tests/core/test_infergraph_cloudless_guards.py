"""InferGraph cloudless guards — Registry allowlist under OFFLINE_MODE."""

from __future__ import annotations

from unittest import mock

import pytest

from inference.core.exceptions import ModelArtefactError
from inference.core.infergraph_registry import (
    is_registry_url_allowed,
    parse_registry_allowlist,
)
from inference.core.registries import roboflow
from inference.core.registries.roboflow import get_model_type


def test_get_model_type_offline_miss_raises_infergraph_guidance_without_http() -> None:
    with mock.patch.object(roboflow, "OFFLINE_MODE", True), mock.patch.object(
        roboflow, "USE_INFERENCE_MODELS", True
    ), mock.patch.object(
        roboflow, "API_BASE_URL", "https://api.roboflow.com"
    ), mock.patch.object(
        roboflow, "get_model_metadata_from_cache", return_value=None
    ), mock.patch.object(
        roboflow, "get_model_metadata_from_inference_models_registry"
    ) as registry_api_mock, mock.patch.object(
        roboflow, "get_roboflow_model_data"
    ) as model_api_mock, mock.patch.object(
        roboflow, "get_roboflow_instant_model_data"
    ) as instant_api_mock, mock.patch(
        "inference.core.roboflow_api._get_from_url"
    ) as get_from_url_mock, mock.patch.dict(
        "os.environ", {"INFERGRAPH_REGISTRY_ALLOWLIST": ""}, clear=False
    ):
        with pytest.raises(ModelArtefactError, match="InferGraph cache") as raised:
            get_model_type(model_id="missing-model/1", api_key=None)

    assert "inferegistry pack" in str(raised.value)
    assert "import-roboflow-cache" in str(raised.value)
    registry_api_mock.assert_not_called()
    model_api_mock.assert_not_called()
    instant_api_mock.assert_not_called()
    get_from_url_mock.assert_not_called()


def test_get_model_type_offline_miss_uses_allowlisted_registry() -> None:
    with mock.patch.object(roboflow, "OFFLINE_MODE", True), mock.patch.object(
        roboflow, "USE_INFERENCE_MODELS", True
    ), mock.patch.object(
        roboflow, "API_BASE_URL", "http://127.0.0.1:8000"
    ), mock.patch.object(
        roboflow, "get_model_metadata_from_cache", return_value=None
    ), mock.patch.object(
        roboflow,
        "get_model_metadata_from_inference_models_registry",
        return_value={"taskType": "object-detection", "modelType": "yolov8"},
    ) as registry_api_mock, mock.patch.object(
        roboflow, "_ensure_model_supported_on_this_deployment"
    ), mock.patch.object(
        roboflow, "save_model_metadata_in_cache"
    ), mock.patch.dict(
        "os.environ",
        {"INFERGRAPH_REGISTRY_ALLOWLIST": "127.0.0.1:8000"},
        clear=False,
    ):
        result = get_model_type(model_id="missing-model/1", api_key=None)

    assert result == ("object-detection", "yolov8")
    registry_api_mock.assert_called_once()


def test_allowlist_never_includes_roboflow_cloud() -> None:
    allowed = parse_registry_allowlist(
        "api.roboflow.com,127.0.0.1:8000",
        api_base_url="https://api.roboflow.com",
        roboflow_api_host="https://api.roboflow.com",
    )
    assert "127.0.0.1:8000" in allowed
    assert not any("roboflow" in host for host in allowed)
    assert is_registry_url_allowed(
        "http://127.0.0.1:8000/models/v1/external/stat",
        allowlist=allowed,
    )
    assert not is_registry_url_allowed(
        "https://api.roboflow.com/models/v1/external/stat",
        allowlist=allowed,
    )


def test_offline_mode_disables_metrics_anchor() -> None:
    """Anchor: existing offline configuration forces metrics off."""
    from inference.core import env

    if not env.OFFLINE_MODE:
        pytest.skip(
            "Requires OFFLINE_MODE process latch; covered by offline config tests"
        )
    assert env.METRICS_ENABLED is False
