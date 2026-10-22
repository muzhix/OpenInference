"""Workflow Studio specification validation.

Mirrors the Roboflow cloud editor semantics: dangling references and
duplicated names block saving, while unknown blocks, unknown step outputs and
kind mismatches are advisory warnings only. Selector syntax is checked
leniently — UQL suffixes such as ``$steps.a.predictions[0]`` are accepted.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Set, Tuple

from pydantic import BaseModel, Field

from inference_server.workflow_studio.spec_models import WorkflowSpecification

INPUT_SELECTOR_PATTERN = re.compile(r"^\$inputs\.([A-Za-z0-9_]+)")
STEP_SELECTOR_PATTERN = re.compile(r"^\$steps\.([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)")

_SELECTOR_PREFIXES = ("$inputs.", "$steps.")


class ValidationFinding(BaseModel):
    """Single validation error or warning attached to a spec location."""

    code: str = Field(
        description="Machine-readable finding code.",
        examples=["dangling_reference"],
    )
    path: str = Field(
        description="Dotted location of the finding within the specification.",
        examples=["steps.blur.image"],
    )
    message: str = Field(
        description="Human-readable description of the finding.",
    )


class ValidationResult(BaseModel):
    """Outcome of validating one workflow specification."""

    errors: List[ValidationFinding] = Field(
        default_factory=list,
        description="Blocking findings; a non-empty list forbids saving.",
    )
    warnings: List[ValidationFinding] = Field(
        default_factory=list,
        description="Advisory findings that do not block saving.",
    )


def validate_spec(
    specification: WorkflowSpecification, registry: Dict[str, Any]
) -> Dict[str, List[Dict[str, str]]]:
    """Validate a parsed specification against a blocks registry payload.

    Args:
        specification: Parsed workflow specification.
        registry: ``describe_workflows_blocks(...)`` payload as a plain dict
            (``blocks``, ``kinds_connections`` keys are used).

    Returns:
        ``{"errors": [...], "warnings": [...]}`` with findings shaped as
        ``{code, path, message}``.
    """
    errors: List[ValidationFinding] = []
    warnings: List[ValidationFinding] = []

    errors.extend(_duplicate_name_errors(specification=specification))

    step_types = {step.name: step.type for step in specification.steps}
    block_outputs, accepted_kinds = _registry_index(registry=registry)

    for step in specification.steps:
        if step.type not in block_outputs:
            warnings.append(
                ValidationFinding(
                    code="unknown_block",
                    path=f"steps.{step.name}",
                    message=f"Step type {step.type!r} is not present in the local "
                    "block registry",
                )
            )

    for step in specification.steps:
        for property_name, selector in _step_selectors(step=step):
            _check_reference(
                selector=selector,
                path=f"steps.{step.name}.{property_name}",
                specification=specification,
                step_types=step_types,
                block_outputs=block_outputs,
                accepted_kinds=accepted_kinds,
                target_block_type=step.type,
                target_property=property_name,
                errors=errors,
                warnings=warnings,
            )

    for workflow_output in specification.outputs:
        _check_reference(
            selector=workflow_output.selector,
            path=f"outputs.{workflow_output.name}",
            specification=specification,
            step_types=step_types,
            block_outputs=block_outputs,
            accepted_kinds=accepted_kinds,
            target_block_type=None,
            target_property=None,
            errors=errors,
            warnings=warnings,
        )

    result = ValidationResult(errors=errors, warnings=warnings)

    return result.model_dump()


def _duplicate_name_errors(
    *, specification: WorkflowSpecification
) -> List[ValidationFinding]:
    findings = []

    seen_steps: Set[str] = set()
    for step in specification.steps:
        if step.name in seen_steps:
            findings.append(
                ValidationFinding(
                    code="duplicate_name",
                    path=f"steps.{step.name}",
                    message=f"Step name {step.name!r} is used more than once",
                )
            )
        seen_steps.add(step.name)

    seen_outputs: Set[str] = set()
    for workflow_output in specification.outputs:
        if workflow_output.name in seen_outputs:
            findings.append(
                ValidationFinding(
                    code="duplicate_name",
                    path=f"outputs.{workflow_output.name}",
                    message=f"Output name {workflow_output.name!r} is used more "
                    "than once",
                )
            )
        seen_outputs.add(workflow_output.name)

    return findings


def _step_selectors(*, step) -> List[Tuple[str, str]]:
    selectors = []

    parameters = step.model_dump(exclude_none=True)
    for property_name, value in parameters.items():
        if property_name in ("type", "name"):
            continue

        for selector in _collect_selector_strings(value=value):
            selectors.append((property_name, selector))

    return selectors


def _collect_selector_strings(*, value: Any) -> List[str]:
    if isinstance(value, str):
        return [value] if value.startswith(_SELECTOR_PREFIXES) else []
    if isinstance(value, list):
        selectors = []
        for element in value:
            selectors.extend(_collect_selector_strings(value=element))

        return selectors
    if isinstance(value, dict):
        selectors = []
        for element in value.values():
            selectors.extend(_collect_selector_strings(value=element))

        return selectors

    return []


def _registry_index(
    *, registry: Dict[str, Any]
) -> Tuple[Dict[str, Dict[str, List[str]]], Dict[Tuple[str, str], Set[str]]]:
    """Index a registry payload into output kinds and accepted-kind lookups."""
    block_outputs: Dict[str, Dict[str, List[str]]] = {}
    for block in registry.get("blocks", []):
        outputs = {
            str(output.get("name")): _kind_names(output=output)
            for output in block.get("outputs_manifest", [])
        }
        identifiers = [block.get("manifest_type_identifier")]
        identifiers.extend(block.get("manifest_type_identifier_aliases") or [])
        for identifier in identifiers:
            if identifier:
                block_outputs[str(identifier)] = outputs

    accepted_kinds: Dict[Tuple[str, str], Set[str]] = {}
    for kind_name, connections in (registry.get("kinds_connections") or {}).items():
        for connection in connections:
            key = (
                str(connection.get("manifest_type_identifier")),
                str(connection.get("property_name")),
            )
            accepted_kinds.setdefault(key, set()).add(str(kind_name))

    return block_outputs, accepted_kinds


def _kind_names(*, output: Dict[str, Any]) -> List[str]:
    kinds = output.get("kind") or []

    return [str(kind.get("name")) for kind in kinds if kind.get("name")]


def _check_reference(
    *,
    selector: str,
    path: str,
    specification: WorkflowSpecification,
    step_types: Dict[str, str],
    block_outputs: Dict[str, Dict[str, List[str]]],
    accepted_kinds: Dict[Tuple[str, str], Set[str]],
    target_block_type: Optional[str],
    target_property: Optional[str],
    errors: List[ValidationFinding],
    warnings: List[ValidationFinding],
) -> None:
    input_match = INPUT_SELECTOR_PATTERN.match(selector)
    if input_match is not None:
        input_name = input_match.group(1)
        if input_name not in specification.input_names():
            errors.append(
                ValidationFinding(
                    code="dangling_reference",
                    path=path,
                    message=f"Selector {selector!r} refers to input "
                    f"{input_name!r} which is not declared",
                )
            )

        return

    step_match = STEP_SELECTOR_PATTERN.match(selector)
    if step_match is None:
        return

    step_name, output_name = step_match.group(1), step_match.group(2)
    if step_name not in step_types:
        errors.append(
            ValidationFinding(
                code="dangling_reference",
                path=path,
                message=f"Selector {selector!r} refers to step {step_name!r} "
                "which does not exist",
            )
        )

        return

    source_kinds: Optional[List[str]] = None
    block_type = step_types[step_name]
    outputs = block_outputs.get(block_type)
    if outputs is not None:
        if output_name not in outputs:
            warnings.append(
                ValidationFinding(
                    code="unknown_step_output",
                    path=path,
                    message=f"Selector {selector!r} refers to output "
                    f"{output_name!r} which block {block_type!r} does not declare",
                )
            )
        else:
            source_kinds = outputs[output_name]

    if (
        source_kinds is not None
        and target_block_type is not None
        and target_property is not None
    ):
        _check_kind_compatibility(
            selector=selector,
            path=path,
            source_kinds=source_kinds,
            accepted=accepted_kinds.get((target_block_type, target_property)),
            warnings=warnings,
        )


def _check_kind_compatibility(
    *,
    selector: str,
    path: str,
    source_kinds: List[str],
    accepted: Optional[Set[str]],
    warnings: List[ValidationFinding],
) -> None:
    if not accepted:
        return

    if source_kinds and not (set(source_kinds) & accepted):
        warnings.append(
            ValidationFinding(
                code="kind_mismatch",
                path=path,
                message=f"Selector {selector!r} produces kinds "
                f"{sorted(source_kinds)} but the property accepts "
                f"{sorted(accepted)}",
            )
        )
