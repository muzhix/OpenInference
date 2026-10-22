"""Blocks registry for Workflow Studio, generated from local blocks.

Wraps ``roboflow_workflows.http_contract.describe.describe_workflows_blocks``
— the same payload served by ``POST /workflows/blocks/describe`` — behind a
process-wide cache because the first introspection takes seconds.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any, Dict

from roboflow_workflows.http_contract.describe import describe_workflows_blocks


@lru_cache(maxsize=1)
def _describe_blocks_payload() -> Dict[str, Any]:
    description = describe_workflows_blocks()

    payload = description.model_dump()

    return payload


def get_registry_payload() -> Dict[str, Any]:
    """Return the cached blocks registry payload as a plain dict.

    The first call is slow (full block introspection); later calls reuse the
    process-wide cache.

    Returns:
        Payload with ``blocks``, ``declared_kinds``, ``kinds_connections``,
        ``primitives_connections``, ``universal_query_language_description``
        and ``dynamic_block_definition_schema`` keys.
    """
    payload = _describe_blocks_payload()

    return payload
