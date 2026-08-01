#!/usr/bin/env python3
"""InferGraph release scan — fail if profiles/Dockerfile/landing regress to Roboflow cloud."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

FORBIDDEN_URL_SNIPPETS = (
    "api.roboflow.com",
    "app.roboflow.com",
    "blog.roboflow.com",
    "inference.roboflow.com",
    "source.roboflow.com",
    "cdnjs.cloudflare.com",
)

PROFILE_FILES = (
    ROOT / "env.infergraph",
    ROOT / "docker" / "env.infergraph",
)

DOCKERFILE = ROOT / "docker" / "dockerfiles" / "Dockerfile.infergraph.cpu"

LANDING_SRC_GLOBS = (
    "inference/landing/src/**/*.tsx",
    "inference/landing/src/**/*.ts",
    "inference/landing/src/**/*.jsx",
    "inference/landing/src/**/*.js",
)

LANDING_OUT_GLOBS = (
    "inference/landing/out/**/*.html",
)

ENTERPRISE_COPY = "COPY inference/enterprise"


def _scan_paths(patterns: tuple[str, ...], snippets: tuple[str, ...]) -> list[str]:
    errors: list[str] = []
    seen: set[Path] = set()
    for pattern in patterns:
        for path in ROOT.glob(pattern):
            if not path.is_file() or path in seen:
                continue
            seen.add(path)
            try:
                body = path.read_text(encoding="utf-8", errors="replace")
            except OSError as exc:
                errors.append(f"cannot read {path.relative_to(ROOT)}: {exc}")
                continue
            for snippet in snippets:
                if snippet in body:
                    errors.append(
                        f"{path.relative_to(ROOT)} contains forbidden `{snippet}`"
                    )
    return errors


def main() -> int:
    errors: list[str] = []

    if not DOCKERFILE.is_file():
        errors.append(f"missing {DOCKERFILE.relative_to(ROOT)}")
    else:
        text = DOCKERFILE.read_text(encoding="utf-8")
        if ENTERPRISE_COPY in text:
            errors.append(
                f"{DOCKERFILE.relative_to(ROOT)} must not contain `{ENTERPRISE_COPY}`"
            )
        if "infergraph-build/dist" not in text:
            errors.append(
                f"{DOCKERFILE.relative_to(ROOT)} should COPY infergraph-build/dist"
            )

    for path in PROFILE_FILES:
        if not path.is_file():
            errors.append(f"missing {path.relative_to(ROOT)}")
            continue
        body = path.read_text(encoding="utf-8")
        for snippet in ("api.roboflow.com", "app.roboflow.com"):
            if snippet in body:
                errors.append(f"{path.relative_to(ROOT)} contains forbidden `{snippet}`")
        if "ENABLE_BUILDER=True" not in body and "ENABLE_BUILDER=true" not in body:
            errors.append(f"{path.relative_to(ROOT)} should set ENABLE_BUILDER=True")
        if "PROJECT=infergraph" not in body:
            errors.append(f"{path.relative_to(ROOT)} should set PROJECT=infergraph")

    errors.extend(_scan_paths(LANDING_SRC_GLOBS, FORBIDDEN_URL_SNIPPETS))
    # Built landing is what the server serves — keep it clean too.
    errors.extend(
        _scan_paths(
            LANDING_OUT_GLOBS,
            (
                "cdnjs.cloudflare.com",
                "blog.roboflow.com",
                "source.roboflow.com",
                "inference.roboflow.com",
            ),
        )
    )

    if errors:
        print("infergraph_release_scan FAILED:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    print("infergraph_release_scan: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
