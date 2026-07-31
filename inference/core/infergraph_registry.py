"""InferGraph Registry allowlist helpers for OFFLINE_MODE.

Re-exports the shared implementation from ``inference_models`` so Inference and
weights-provider paths use the same rules.
"""

from inference_models.registry_allowlist import (
    is_registry_url_allowed,
    is_roboflow_host,
    offline_http_allowed_for_url,
    parse_registry_allowlist,
)

__all__ = [
    "is_registry_url_allowed",
    "is_roboflow_host",
    "offline_http_allowed_for_url",
    "parse_registry_allowlist",
]


def has_allowlisted_registry() -> bool:
    """Return True if at least one non-Roboflow registry host is configured."""
    return bool(parse_registry_allowlist())
