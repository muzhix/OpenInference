"""InferGraph env alias precedence (INFERGRAPH_* over ROBOFLOW_*)."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

_REPO_ROOT = str(Path(__file__).resolve().parents[4])
_INFERENCE_MODELS_ROOT = str(Path(_REPO_ROOT) / "inference_models")


def _run_env_snippet(code: str, env: dict) -> str:
    process_env = {**os.environ, **env}
    process_env["PYTHONPATH"] = (
        _INFERENCE_MODELS_ROOT
        + os.pathsep
        + _REPO_ROOT
        + os.pathsep
        + process_env.get("PYTHONPATH", "")
    )
    # Avoid inheriting caller keys that would pollute alias checks.
    for key in (
        "INFERGRAPH_API_KEY",
        "ROBOFLOW_API_KEY",
        "API_KEY",
        "INFERGRAPH_API_HOST",
        "ROBOFLOW_API_HOST",
        "INFERGRAPH_API_EXTRA_HEADERS",
        "ROBOFLOW_API_EXTRA_HEADERS",
    ):
        if key not in env:
            process_env.pop(key, None)
    result = subprocess.run(
        [sys.executable, "-c", code],
        env=process_env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()


def test_infergraph_api_key_preferred_over_roboflow() -> None:
    out = _run_env_snippet(
        "from inference.core import env; print(env.API_KEY)",
        {
            "INFERGRAPH_API_KEY": "ig-key",
            "ROBOFLOW_API_KEY": "rf-key",
            "DISABLE_VERSION_CHECK": "True",
            "USE_INFERENCE_MODELS": "False",
        },
    )
    assert out == "ig-key"


def test_roboflow_api_key_still_works() -> None:
    out = _run_env_snippet(
        "from inference.core import env; print(env.API_KEY)",
        {
            "ROBOFLOW_API_KEY": "rf-only",
            "DISABLE_VERSION_CHECK": "True",
            "USE_INFERENCE_MODELS": "False",
        },
    )
    assert out == "rf-only"


def test_infergraph_api_host_preferred_in_inference_models() -> None:
    out = _run_env_snippet(
        "from inference_models import configuration as c; print(c.ROBOFLOW_API_HOST)",
        {
            "INFERGRAPH_API_HOST": "http://127.0.0.1:8000",
            "ROBOFLOW_API_HOST": "https://api.roboflow.com",
            "DISABLE_VERSION_CHECK": "True",
        },
    )
    assert out == "http://127.0.0.1:8000"


def test_getenv_aliased_helper() -> None:
    out = _run_env_snippet(
        "from inference.core.env import getenv_aliased; "
        "import os; "
        "os.environ['INFERGRAPH_API_EXTRA_HEADERS']='{\"a\":1}'; "
        "os.environ['ROBOFLOW_API_EXTRA_HEADERS']='{\"b\":2}'; "
        "print(getenv_aliased('INFERGRAPH_API_EXTRA_HEADERS','ROBOFLOW_API_EXTRA_HEADERS'))",
        {"DISABLE_VERSION_CHECK": "True", "USE_INFERENCE_MODELS": "False"},
    )
    assert out == '{"a":1}'
