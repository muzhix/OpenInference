"""Lenient Pydantic models for the Workflow Studio specification format.

The editor persists work-in-progress graphs, so models intentionally accept
more than the execution engine would: unknown step parameters are preserved,
``steps`` may be given as a list or as a name-keyed dictionary and the stored
config may be either a bare specification or a ``{"specification": {...}}``
wrapper (the shape the Roboflow cloud uses).
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field


class SpecParseError(ValueError):
    """Raised when a config payload cannot be interpreted as a specification."""

    def __init__(self, message: str, *, path: str = "") -> None:
        super().__init__(message)
        self.message = message
        self.path = path


class WorkflowInput(BaseModel):
    """Single workflow input declaration."""

    model_config = ConfigDict(extra="allow")

    type: str = Field(
        description="Input type identifier, e.g. ``WorkflowImage``.",
        examples=["WorkflowImage"],
    )
    name: str = Field(
        description="Input name used in ``$inputs.<name>`` selectors.",
        examples=["image"],
    )


class WorkflowStep(BaseModel):
    """Single workflow step; every non-``type``/``name`` key is a parameter."""

    model_config = ConfigDict(extra="allow")

    type: str = Field(
        description="Block manifest type identifier.",
        examples=["roboflow_core/image_blur@v1"],
    )
    name: str = Field(
        description="Unique step name used in ``$steps.<name>.<output>`` selectors.",
        examples=["blur"],
    )

    def to_spec_dict(self) -> Dict[str, Any]:
        """Return the step as a plain dict, including unknown parameters."""
        step_dict = self.model_dump(exclude_none=True)

        return step_dict


class WorkflowOutput(BaseModel):
    """Single workflow output declaration."""

    type: str = Field(
        default="JsonField",
        description="Output type identifier.",
        examples=["JsonField"],
    )
    name: str = Field(
        description="Output name exposed in run responses.",
        examples=["blur_output"],
    )
    selector: str = Field(
        description="Selector pointing at the value to expose.",
        examples=["$steps.blur.image"],
    )


class WorkflowSpecification(BaseModel):
    """Workflow specification as persisted by Workflow Studio."""

    model_config = ConfigDict(extra="allow")

    version: str = Field(
        default="1.0",
        description="Specification version.",
        examples=["1.0"],
    )
    inputs: List[WorkflowInput] = Field(
        default_factory=list,
        description="Declared workflow inputs.",
    )
    steps: List[WorkflowStep] = Field(
        default_factory=list,
        description="Workflow steps in execution order.",
    )
    outputs: List[WorkflowOutput] = Field(
        default_factory=list,
        description="Declared workflow outputs.",
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Editor-only metadata (e.g. ``metadata.ui`` canvas layout).",
    )

    def input_names(self) -> List[str]:
        """Return declared input names in declaration order."""
        names = [workflow_input.name for workflow_input in self.inputs]

        return names

    def step_names(self) -> List[str]:
        """Return step names in declaration order."""
        names = [step.name for step in self.steps]

        return names

    def to_config_dict(self) -> Dict[str, Any]:
        """Return the specification as a plain dict, including unknown keys."""
        spec_dict = self.model_dump(exclude_none=True)

        return spec_dict


def normalize_config(config: Union[dict, str, None]) -> Dict[str, Any]:
    """Normalize a config given as a JSON object or a JSON string into a dict.

    Args:
        config: Config payload as a mapping or a JSON-encoded string.

    Returns:
        The config as a plain dictionary.

    Raises:
        SpecParseError: If the payload is not a JSON object.
    """
    if config is None:
        raise SpecParseError("Config payload is missing", path="")
    if isinstance(config, str):
        try:
            parsed = json.loads(config)
        except json.JSONDecodeError as error:
            raise SpecParseError(
                f"Config is not valid JSON: {error.msg}", path=""
            ) from error
    else:
        parsed = config

    if not isinstance(parsed, dict):
        raise SpecParseError(
            f"Config must be a JSON object, got {type(parsed).__name__}", path=""
        )

    if set(parsed) == {"specification"}:
        specification = parsed["specification"]

        if not isinstance(specification, dict):
            raise SpecParseError(
                "Config wrapper 'specification' must be a JSON object", path=""
            )

        return specification

    return parsed


def extract_specification(config: Dict[str, Any]) -> Dict[str, Any]:
    """Return the specification mapping out of a stored config dict.

    Accepts both the bare specification and the cloud-style
    ``{"specification": {...}}`` wrapper.

    Args:
        config: Normalized config dictionary.

    Returns:
        The specification mapping.

    Raises:
        SpecParseError: If no specification mapping can be located.
    """
    inner = config.get("specification")
    if isinstance(inner, dict):
        return inner

    looks_like_spec = any(key in config for key in ("version", "inputs", "steps"))
    if looks_like_spec:
        return config

    raise SpecParseError(
        'Config does not contain a specification (expected "specification" key '
        "or a bare specification object)",
        path="",
    )


def parse_workflow_specification(
    config: Union[dict, str, None],
) -> WorkflowSpecification:
    """Parse a config payload (object or JSON string) into a specification.

    Args:
        config: Config payload as a mapping or a JSON-encoded string.

    Returns:
        The parsed :class:`WorkflowSpecification`.

    Raises:
        SpecParseError: If the payload cannot be parsed.
    """
    normalized = normalize_config(config)
    spec_dict = extract_specification(normalized)

    spec_dict = normalize_steps_collection(spec_dict=spec_dict)

    try:
        specification = WorkflowSpecification.model_validate(spec_dict)
    except ValueError as error:
        raise SpecParseError(
            f"Specification does not parse: {error}", path="specification"
        ) from error

    return specification


def normalize_steps_collection(*, spec_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Convert name-keyed ``steps`` dictionaries into the canonical list form.

    Args:
        spec_dict: Specification mapping whose ``steps`` may be a dict.

    Returns:
        Specification mapping with ``steps`` as a list.

    Raises:
        SpecParseError: If a name-keyed step body is not an object.
    """
    steps = spec_dict.get("steps")
    if not isinstance(steps, dict):
        return spec_dict

    normalized_steps = []
    for step_name, step_body in steps.items():
        if not isinstance(step_body, dict):
            raise SpecParseError(
                f"Step {step_name!r} must be an object", path=f"steps.{step_name}"
            )
        merged = dict(step_body)
        merged.setdefault("name", step_name)
        normalized_steps.append(merged)

    spec_dict = dict(spec_dict)
    spec_dict["steps"] = normalized_steps

    return spec_dict


def canonical_config_string(config: Dict[str, Any]) -> str:
    """Serialize a config dict into the canonical string stored in SQLite.

    Args:
        config: Config payload as a mapping.

    Returns:
        Compact JSON serialization of the config.
    """
    config_string = json.dumps(config, separators=(",", ":"))

    return config_string


def config_object(config_string: str) -> Dict[str, Any]:
    """Parse a stored config string back into a JSON object.

    Args:
        config_string: JSON string as stored in the ``versions`` table.

    Returns:
        The config as a plain dictionary.
    """
    parsed = json.loads(config_string)

    return parsed


STARTER_CONFIG: Dict[str, Any] = {
    "version": "1.0",
    "inputs": [{"type": "WorkflowImage", "name": "image"}],
    "steps": [],
    "outputs": [],
}
