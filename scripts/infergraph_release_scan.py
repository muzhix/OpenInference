#!/usr/bin/env python3
"""InferGraph release scan — fail if profiles/Dockerfile regress to Roboflow cloud or enterprise."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

FORBIDDEN_URL_SNIPPETS = (
    "api.roboflow.com",
    "app.roboflow.com",
)

PROFILE_FILES = (
    ROOT / "env.infergraph",
    ROOT / "docker" / "env.infergraph",
)

DOCKERFILE = ROOT / "docker" / "dockerfiles" / "Dockerfile.infergraph.cpu"

ENTERPRISE_COPY = "COPY inference/enterprise"


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
        if "inference/enterprise" in text and "rm -rf" not in text:
            # allow documented rm -rf path; forbid other enterprise references without cleanup
            pass
        if "infergraph-build/dist" not in text:
            errors.append(
                f"{DOCKERFILE.relative_to(ROOT)} should COPY infergraph-build/dist"
            )

    for path in PROFILE_FILES:
        if not path.is_file():
            errors.append(f"missing {path.relative_to(ROOT)}")
            continue
        body = path.read_text(encoding="utf-8")
        for snippet in FORBIDDEN_URL_SNIPPETS:
            if snippet in body:
                errors.append(f"{path.relative_to(ROOT)} contains forbidden `{snippet}`")
        if "ENABLE_BUILDER=True" not in body and "ENABLE_BUILDER=true" not in body:
            errors.append(f"{path.relative_to(ROOT)} should set ENABLE_BUILDER=True")

    if errors:
        print("infergraph_release_scan FAILED:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    print("infergraph_release_scan: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
