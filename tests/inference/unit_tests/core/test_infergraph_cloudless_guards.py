"""InferGraph P0 cloudless guards — miss path never hits Roboflow HTTP."""

from __future__ import annotations

from unittest import mock

import pytest

from inference.core.exceptions import ModelArtefactError
from inference.core.registries import roboflow
from inference.core.registries.roboflow import get_model_type


def test_get_model_type_offline_miss_raises_infergraph_guidance_without_http() -> None:
    with mock.patch.object(roboflow, "OFFLINE_MODE", True), mock.patch.object(
        roboflow, "USE_INFERENCE_MODELS", True
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
    ) as get_from_url_mock:
        with pytest.raises(ModelArtefactError, match="InferGraph cache") as raised:
            get_model_type(model_id="missing-model/1", api_key=None)

    assert "inferegistry pack" in str(raised.value)
    assert "import-roboflow-cache" in str(raised.value)
    registry_api_mock.assert_not_called()
    model_api_mock.assert_not_called()
    instant_api_mock.assert_not_called()
    get_from_url_mock.assert_not_called()


def test_offline_mode_disables_metrics_anchor() -> None:
    """Anchor: existing offline configuration forces metrics off.

    Full process-latch coverage lives in test_offline_mode_configuration.py.
    """
    from inference.core import env

    if not env.OFFLINE_MODE:
        pytest.skip("Requires OFFLINE_MODE process latch; covered by offline config tests")
    assert env.METRICS_ENABLED is False
