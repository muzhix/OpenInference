"""Unit tests for InferGraph Registry allowlist helpers."""

from inference_models.registry_allowlist import (
    is_registry_url_allowed,
    parse_registry_allowlist,
)


def test_parse_allowlist_strips_roboflow_hosts() -> None:
    allowed = parse_registry_allowlist(
        "inferegistry:8000,api.roboflow.com,api.roboflow.one",
    )
    assert allowed == {"inferegistry:8000"}


def test_is_registry_url_allowed_for_loopback() -> None:
    allowed = parse_registry_allowlist("127.0.0.1:8000")
    assert is_registry_url_allowed(
        "http://127.0.0.1:8000/artifacts/x",
        allowlist=allowed,
    )
    assert not is_registry_url_allowed(
        "https://detect.roboflow.com/x",
        allowlist=allowed,
    )
