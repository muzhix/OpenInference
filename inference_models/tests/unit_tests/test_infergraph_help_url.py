"""InferGraph rehomes legacy Roboflow error-docs URLs."""

from __future__ import annotations

from inference_models.errors import ModelRetrievalError, rewrite_help_url


def test_rewrite_help_url_rehomes_legacy_host(monkeypatch) -> None:
    monkeypatch.delenv("INFERGRAPH_ERRORS_DOCS_BASE", raising=False)
    url = (
        "https://inference-models.roboflow.com/errors/model-retrieval/"
        "#modelretrievalerror"
    )
    out = rewrite_help_url(url)
    assert out is not None
    assert "roboflow.com" not in out
    assert out.endswith("#modelretrievalerror")
    assert "docs/infergraph/errors.md" in out


def test_rewrite_help_url_can_strip(monkeypatch) -> None:
    monkeypatch.setenv("INFERGRAPH_ERRORS_DOCS_BASE", "")
    url = "https://inference-models.roboflow.com/errors/x/#modelretrievalerror"
    assert rewrite_help_url(url) is None


def test_exception_str_uses_rewritten_url(monkeypatch) -> None:
    monkeypatch.delenv("INFERGRAPH_ERRORS_DOCS_BASE", raising=False)
    err = ModelRetrievalError(
        "boom",
        help_url=(
            "https://inference-models.roboflow.com/errors/model-retrieval/"
            "#modelretrievalerror"
        ),
    )
    text = str(err)
    assert "roboflow.com" not in text
    assert "#modelretrievalerror" in text
    assert err.help_url is not None
    assert "modelretrievalerror" in err.help_url
