# InferGraph distribution licenses

When shipping InferGraph images or bundles that include model code/weights:

1. Prefer the upstream CI check: [`.github/workflows/check_model_licenses.yml`](../../.github/workflows/check_model_licenses.yml) and notes in [`inference/models/README.md`](../../inference/models/README.md).
2. **Do not** redistribute `inference/enterprise/` (excluded from InferGraph Dockerfiles).
3. Review AGPL / copyleft model dependencies before bundling weights into a commercial appliance; record decisions in your release notes.
4. Run `python scripts/infergraph_release_scan.py` before tagging an InferGraph release image.

This page is a checklist, not a substitute for legal review.
