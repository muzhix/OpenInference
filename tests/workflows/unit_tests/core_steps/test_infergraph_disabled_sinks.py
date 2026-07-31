"""InferGraph profile disables Roboflow cloud sink blocks via patterns."""

from unittest import mock

from inference.core.workflows.core_steps import loader
from inference.core.workflows.core_steps.integrations.roboflow.visual_search.v1 import (
    RoboflowVisualSearchBlockV1,
)
from inference.core.workflows.core_steps.integrations.roboflow.visual_search_classifier.v1 import (
    RoboflowVisualSearchClassifierBlockV1,
)
from inference.core.workflows.core_steps.sinks.roboflow.asset_library_attributes.v1 import (
    RoboflowAssetLibraryAttributesBlockV1,
)
from inference.core.workflows.core_steps.sinks.roboflow.custom_metadata.v1 import (
    RoboflowCustomMetadataBlockV1,
)
from inference.core.workflows.core_steps.sinks.roboflow.dataset_upload.v1 import (
    RoboflowDatasetUploadBlockV1,
)
from inference.core.workflows.core_steps.sinks.roboflow.model_monitoring_inference_aggregator.v1 import (
    ModelMonitoringInferenceAggregatorBlockV1,
)
from inference.core.workflows.core_steps.sinks.roboflow.vision_events.v1 import (
    RoboflowVisionEventsBlockV1,
)

# Matches env.infergraph / docker/env.infergraph WORKFLOW_DISABLED_BLOCK_PATTERNS
INFERGRAPH_DISABLED_CLOUD_SINK_PATTERNS = [
    "roboflow.dataset_upload",
    "model_monitoring_inference_aggregator",
    "roboflow.custom_metadata",
    "roboflow.vision_events",
    "asset_library_attributes",
    "visual_search",
]

_CLOUD_SINKS = [
    RoboflowDatasetUploadBlockV1,
    ModelMonitoringInferenceAggregatorBlockV1,
    RoboflowCustomMetadataBlockV1,
    RoboflowVisionEventsBlockV1,
    RoboflowAssetLibraryAttributesBlockV1,
    RoboflowVisualSearchBlockV1,
    RoboflowVisualSearchClassifierBlockV1,
]


@mock.patch.object(loader, "WORKFLOW_DISABLED_BLOCK_TYPES", [])
@mock.patch.object(
    loader,
    "WORKFLOW_DISABLED_BLOCK_PATTERNS",
    INFERGRAPH_DISABLED_CLOUD_SINK_PATTERNS,
)
def test_infergraph_patterns_filter_roboflow_cloud_sinks() -> None:
    for block in _CLOUD_SINKS:
        assert loader._should_filter_block(block) is True, block.__name__


@mock.patch.object(loader, "WORKFLOW_DISABLED_BLOCK_TYPES", [])
@mock.patch.object(
    loader,
    "WORKFLOW_DISABLED_BLOCK_PATTERNS",
    INFERGRAPH_DISABLED_CLOUD_SINK_PATTERNS,
)
def test_infergraph_patterns_keep_unrelated_blocks() -> None:
    from inference.core.workflows.core_steps.transformations.detection_offset.v1 import (
        DetectionOffsetBlockV1,
    )

    assert loader._should_filter_block(DetectionOffsetBlockV1) is False
