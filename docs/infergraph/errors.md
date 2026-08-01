# InferGraph error docs

Runtime errors from `inference_models` may append a `VISIT … FOR FURTHER SUPPORT`
link. InferGraph rewrites the legacy `inference-models.roboflow.com` host to this
page (or to `INFERGRAPH_ERRORS_DOCS_BASE` if set).

Fragment anchors are the exception **class name in lowercase**, for example:

- `#modelretrievalerror`
- `#corruptedmodelpackageerror`
- `#modelnotfounderror`

Set `INFERGRAPH_ERRORS_DOCS_BASE=` (empty) to omit help URLs from exception strings.

For offline setup see [OFFLINE.md](../../OFFLINE.md) and [pack.md](pack.md).
