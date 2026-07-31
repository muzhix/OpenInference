"""InferGraph Registry host allowlist for OFFLINE_MODE (inference_models side).

Reads the same env vars as ``inference.core.infergraph_registry`` so both
packages stay aligned without a cross-dependency.
"""

from __future__ import annotations

import os
from typing import Iterable, Optional, Set
from urllib.parse import urlparse

_ROBOFLOW_HOST_SUFFIXES = (
    ".roboflow.com",
    ".roboflow.one",
    "roboflow.com",
    "roboflow.one",
)


def _normalize_host(host: str) -> str:
    host = host.strip().lower()
    if host.startswith("[") and "]" in host:
        # [::1]:8000
        return host
    return host.rstrip(".")


def _host_from_url_or_host(value: str) -> Optional[str]:
    value = value.strip()
    if not value:
        return None
    if "://" not in value:
        value = f"http://{value}"
    parsed = urlparse(value)
    if not parsed.hostname:
        return None
    host = parsed.hostname.lower()
    if parsed.port:
        return f"{host}:{parsed.port}"
    return host


def is_roboflow_host(host: str) -> bool:
    """Return True if host is a Roboflow cloud hostname."""
    hostname = host.lower().rstrip(".")
    if not hostname.startswith("[") and hostname.count(":") == 1:
        hostname = hostname.rsplit(":", 1)[0]
    if hostname in {"roboflow.com", "roboflow.one"}:
        return True
    return hostname.endswith(".roboflow.com") or hostname.endswith(".roboflow.one")


def parse_registry_allowlist(
    explicit: Optional[str] = None,
    *,
    api_base_url: Optional[str] = None,
    roboflow_api_host: Optional[str] = None,
) -> Set[str]:
    """Return allowlisted ``host`` or ``host:port`` entries.

    Args:
        explicit: Comma-separated ``INFERGRAPH_REGISTRY_ALLOWLIST`` value.
        api_base_url: Fallback candidate from ``API_BASE_URL``.
        roboflow_api_host: Fallback candidate from ``ROBOFLOW_API_HOST``.

    Returns:
        Set of normalized hosts; Roboflow cloud hosts are never included.
    """
    raw = (
        explicit
        if explicit is not None
        else os.getenv("INFERGRAPH_REGISTRY_ALLOWLIST", "")
    )
    candidates: list[str] = []
    if raw.strip():
        candidates.extend(part.strip() for part in raw.split(",") if part.strip())
    else:
        for value in (
            api_base_url or os.getenv("API_BASE_URL"),
            roboflow_api_host
            or os.getenv("ROBOFLOW_API_HOST")
            or os.getenv("INFERENCE_MODELS_ROBOFLOW_API_HOST"),
        ):
            if value:
                candidates.append(value)

    allowed: Set[str] = set()
    for candidate in candidates:
        host = _host_from_url_or_host(candidate)
        if host is None:
            continue
        if is_roboflow_host(host):
            continue
        allowed.add(host)
    return allowed


def is_registry_url_allowed(
    url: str,
    *,
    allowlist: Optional[Iterable[str]] = None,
) -> bool:
    """Return True if ``url`` targets an allowlisted non-Roboflow registry host."""
    host = _host_from_url_or_host(url)
    if host is None:
        return False
    if is_roboflow_host(host):
        return False
    allowed = set(allowlist) if allowlist is not None else parse_registry_allowlist()
    if host in allowed:
        return True
    # Also allow bare hostname match when allowlist entry omitted default port
    hostname = host.rsplit(":", 1)[0] if not host.startswith("[") else host
    if hostname in allowed:
        return True
    return False


def offline_http_allowed_for_url(url: str) -> bool:
    """Whether OFFLINE_MODE may still issue this HTTP request."""
    return is_registry_url_allowed(url)
