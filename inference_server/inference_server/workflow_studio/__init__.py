"""Workflow Studio backend — local workflow editor API (``/api/wf/*``).

Provides a SQLite version-chain store for workflow specifications, a block
registry generated from the installed ``roboflow_workflows`` package,
cloud-compatible save/draft/publish semantics and a run endpoint backed by the
existing workflows execution engine. Serves the bundled editor SPA at
``/studio`` when ``workflow_studio/dist`` has been built.
"""
