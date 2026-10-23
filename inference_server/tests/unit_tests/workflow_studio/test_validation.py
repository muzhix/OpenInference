from inference_server.workflow_studio.spec_models import (
    SpecParseError,
    parse_workflow_specification,
)
from inference_server.workflow_studio.validation import validate_spec

FAKE_REGISTRY = {
    "blocks": [
        {
            "manifest_type_identifier": "test/blur@v1",
            "manifest_type_identifier_aliases": ["test/blur_alias@v1"],
            "outputs_manifest": [{"name": "image", "kind": [{"name": "image"}]}],
        },
        {
            "manifest_type_identifier": "test/det@v1",
            "manifest_type_identifier_aliases": [],
            "outputs_manifest": [
                {
                    "name": "predictions",
                    "kind": [{"name": "object_detection_prediction"}],
                }
            ],
        },
        {
            "manifest_type_identifier": "test/sink@v1",
            "manifest_type_identifier_aliases": [],
            "outputs_manifest": [{"name": "done", "kind": [{"name": "flag"}]}],
        },
    ],
    "kinds_connections": {
        "image": [
            {"manifest_type_identifier": "test/blur@v1", "property_name": "image"}
        ],
        "detection_instance": [
            {"manifest_type_identifier": "test/sink@v1", "property_name": "input"}
        ],
    },
}


def _validate(config):
    specification = parse_workflow_specification(config)
    result = validate_spec(specification=specification, registry=FAKE_REGISTRY)

    return result


def test_valid_spec_passes_without_findings():
    config = {
        "specification": {
            "version": "1.0",
            "inputs": [{"type": "WorkflowImage", "name": "image"}],
            "steps": [
                {
                    "type": "test/blur@v1",
                    "name": "blur",
                    "image": "$inputs.image",
                }
            ],
            "outputs": [
                {
                    "type": "JsonField",
                    "name": "out",
                    "selector": "$steps.blur.image",
                }
            ],
        }
    }

    result = _validate(config)

    assert result["errors"] == []
    assert result["warnings"] == []


def test_dangling_step_reference_is_an_error():
    config = {
        "specification": {
            "version": "1.0",
            "inputs": [{"type": "WorkflowImage", "name": "image"}],
            "steps": [
                {
                    "type": "test/blur@v1",
                    "name": "blur",
                    "image": "$steps.ghost.image",
                }
            ],
            "outputs": [],
        }
    }

    result = _validate(config)

    assert [error["code"] for error in result["errors"]] == ["dangling_reference"]
    assert result["errors"][0]["path"] == "steps.blur.image"


def test_dangling_input_reference_is_an_error():
    config = {
        "specification": {
            "version": "1.0",
            "inputs": [{"type": "WorkflowImage", "name": "image"}],
            "steps": [
                {
                    "type": "test/blur@v1",
                    "name": "blur",
                    "image": "$inputs.not_declared",
                }
            ],
            "outputs": [],
        }
    }

    result = _validate(config)

    assert [error["code"] for error in result["errors"]] == ["dangling_reference"]
    assert result["errors"][0]["path"] == "steps.blur.image"


def test_dangling_output_selector_is_an_error():
    config = {
        "specification": {
            "version": "1.0",
            "inputs": [],
            "steps": [],
            "outputs": [
                {
                    "type": "JsonField",
                    "name": "out",
                    "selector": "$steps.missing.output",
                }
            ],
        }
    }

    result = _validate(config)

    assert [error["code"] for error in result["errors"]] == ["dangling_reference"]
    assert result["errors"][0]["path"] == "outputs.out"


def test_duplicate_step_and_output_names_are_errors():
    config = {
        "specification": {
            "version": "1.0",
            "inputs": [{"type": "WorkflowParameter", "name": "x"}],
            "steps": [
                {"type": "test/blur@v1", "name": "same", "image": "literal"},
                {"type": "test/blur@v1", "name": "same", "image": "literal"},
            ],
            "outputs": [
                {"type": "JsonField", "name": "out", "selector": "$inputs.x"},
                {"type": "JsonField", "name": "out", "selector": "$inputs.x"},
            ],
        }
    }

    result = _validate(config)

    assert sorted(error["code"] for error in result["errors"]) == [
        "duplicate_name",
        "duplicate_name",
    ]
    assert sorted(error["path"] for error in result["errors"]) == [
        "outputs.out",
        "steps.same",
    ]


def test_unknown_block_type_is_a_warning():
    config = {
        "specification": {
            "version": "1.0",
            "inputs": [],
            "steps": [{"type": "nope/block@v1", "name": "step", "p": "literal"}],
            "outputs": [],
        }
    }

    result = _validate(config)

    assert result["errors"] == []
    assert [warning["code"] for warning in result["warnings"]] == ["unknown_block"]


def test_unknown_step_output_is_a_warning():
    config = {
        "specification": {
            "version": "1.0",
            "inputs": [{"type": "WorkflowImage", "name": "image"}],
            "steps": [
                {
                    "type": "test/blur@v1",
                    "name": "blur",
                    "image": "$inputs.image",
                }
            ],
            "outputs": [
                {
                    "type": "JsonField",
                    "name": "out",
                    "selector": "$steps.blur.not_an_output",
                }
            ],
        }
    }

    result = _validate(config)

    assert result["errors"] == []
    assert [warning["code"] for warning in result["warnings"]] == [
        "unknown_step_output"
    ]


def test_all_properties_workflow_output_is_the_whole_step_object():
    config = {
        "specification": {
            "version": "1.0",
            "inputs": [{"type": "WorkflowImage", "name": "image"}],
            "steps": [
                {
                    "type": "test/blur@v1",
                    "name": "blur",
                    "image": "$inputs.image",
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
                    "name": "out_star",
                    "selector": "$steps.blur.*",
                },
            ],
        }
    }

    result = _validate(config)

    assert result["errors"] == []
    assert result["warnings"] == []


def test_all_properties_on_a_step_input_is_still_an_unknown_output():
    config = {
        "specification": {
            "version": "1.0",
            "inputs": [{"type": "WorkflowImage", "name": "image"}],
            "steps": [
                {
                    "type": "test/blur@v1",
                    "name": "blur",
                    "image": "$inputs.image",
                },
                {
                    "type": "test/sink@v1",
                    "name": "sink",
                    "input": "$steps.blur.all_properties",
                },
            ],
            "outputs": [],
        }
    }

    result = _validate(config)

    assert result["errors"] == []
    assert [warning["code"] for warning in result["warnings"]] == [
        "unknown_step_output"
    ]


def test_kind_mismatch_is_a_warning_when_both_sides_are_known():
    config = {
        "specification": {
            "version": "1.0",
            "inputs": [{"type": "WorkflowImage", "name": "image"}],
            "steps": [
                {
                    "type": "test/blur@v1",
                    "name": "blur",
                    "image": "$inputs.image",
                },
                {
                    "type": "test/sink@v1",
                    "name": "sink",
                    "input": "$steps.blur.image",
                },
            ],
            "outputs": [],
        }
    }

    result = _validate(config)

    assert result["errors"] == []
    assert [warning["code"] for warning in result["warnings"]] == ["kind_mismatch"]


def test_kind_check_is_skipped_when_source_side_is_unknown():
    config = {
        "specification": {
            "version": "1.0",
            "inputs": [{"type": "WorkflowImage", "name": "image"}],
            "steps": [
                {
                    "type": "nope/block@v1",
                    "name": "ghost",
                    "p": "$inputs.image",
                },
                {
                    "type": "test/sink@v1",
                    "name": "sink",
                    "input": "$steps.ghost.output",
                },
            ],
            "outputs": [],
        }
    }

    result = _validate(config)

    assert result["errors"] == []
    assert [warning["code"] for warning in result["warnings"]] == ["unknown_block"]


def test_selectors_inside_lists_and_uql_suffixes_are_scanned():
    config = {
        "specification": {
            "version": "1.0",
            "inputs": [{"type": "WorkflowImage", "name": "image"}],
            "steps": [
                {
                    "type": "test/blur@v1",
                    "name": "blur",
                    "image": "$inputs.image[0]",
                },
                {
                    "type": "test/blur@v1",
                    "name": "second",
                    "image": "$inputs.image",
                    "extra": ["$steps.nope.output"],
                },
            ],
            "outputs": [
                {
                    "type": "JsonField",
                    "name": "out",
                    "selector": "$steps.blur.image[:1]",
                }
            ],
        }
    }

    result = _validate(config)

    assert [error["code"] for error in result["errors"]] == ["dangling_reference"]
    assert result["errors"][0]["path"] == "steps.second.extra"


def test_legacy_inference_image_input_type_parses():
    config = {
        "specification": {
            "version": "1.0",
            "inputs": [{"type": "InferenceImage", "name": "image"}],
            "steps": [
                {
                    "type": "test/blur@v1",
                    "name": "blur",
                    "image": "$inputs.image",
                }
            ],
            "outputs": [],
        }
    }

    result = _validate(config)

    assert result["errors"] == []


def test_name_keyed_steps_dictionary_is_accepted():
    config = {
        "specification": {
            "version": "1.0",
            "inputs": [{"type": "WorkflowImage", "name": "image"}],
            "steps": {
                "blur": {"type": "test/blur@v1", "image": "$inputs.image"},
            },
            "outputs": [
                {"type": "JsonField", "name": "out", "selector": "$steps.blur.image"}
            ],
        }
    }

    result = _validate(config)

    assert result["errors"] == []
    assert result["warnings"] == []


def test_unparseable_spec_is_reported_as_invalid_spec():
    try:
        parse_workflow_specification("not json at all")
        raised = None
    except SpecParseError as error:
        raised = error

    assert raised is not None

    config_missing_specification = {"unrelated": True}
    try:
        parse_workflow_specification(config_missing_specification)
        raised = None
    except SpecParseError as error:
        raised = error

    assert raised is not None


def test_validation_against_real_registry_flags_unknown_block():
    from inference_server.workflow_studio import registry

    config = {
        "specification": {
            "version": "1.0",
            "inputs": [{"type": "WorkflowImage", "name": "image"}],
            "steps": [
                {
                    "type": "roboflow_core/image_blur@v1",
                    "name": "blur",
                    "image": "$inputs.image",
                },
                {
                    "type": "totally/unknown@v9",
                    "name": "ghost",
                    "image": "$inputs.image",
                },
            ],
            "outputs": [
                {
                    "type": "JsonField",
                    "name": "out",
                    "selector": "$steps.blur.image",
                }
            ],
        }
    }
    specification = parse_workflow_specification(config)
    result = validate_spec(
        specification=specification, registry=registry.get_registry_payload()
    )

    assert result["errors"] == []
    assert [warning["code"] for warning in result["warnings"]] == ["unknown_block"]
