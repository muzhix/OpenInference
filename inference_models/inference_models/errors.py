import os
from typing import List, Optional

# Legacy upstream docs host embedded in raise sites across this package.
_LEGACY_ERRORS_DOCS_HOST = "https://inference-models.roboflow.com"
# InferGraph default: local markdown (anchors preserved for class names).
_DEFAULT_ERRORS_DOCS_BASE = (
    "https://github.com/muzhix/inference/blob/main/docs/infergraph/errors.md"
)


def rewrite_help_url(url: Optional[str]) -> Optional[str]:
    """Rehome Roboflow error-docs URLs to InferGraph docs (or strip).

    ``INFERGRAPH_ERRORS_DOCS_BASE`` overrides the replacement base.
    Set it to empty to omit help URLs from exception strings.
    """
    if not url:
        return url
    if _LEGACY_ERRORS_DOCS_HOST not in url:
        return url
    base = os.getenv("INFERGRAPH_ERRORS_DOCS_BASE", _DEFAULT_ERRORS_DOCS_BASE)
    if base == "":
        return None
    anchor = ""
    if "#" in url:
        anchor = "#" + url.rsplit("#", 1)[1]
    return f"{base.rstrip('/')}{anchor}"


class BaseInferenceModelsError(Exception):

    def __init__(self, message: str, help_url: Optional[str] = None):
        super().__init__(message)
        self._help_url = help_url

    @property
    def help_url(self) -> Optional[str]:
        return rewrite_help_url(self._help_url)

    def __str__(self) -> str:
        url = self.help_url
        if url is None:
            return super().__str__()
        return f"{super().__str__()} - VISIT {url} FOR FURTHER SUPPORT"


class AssumptionError(BaseInferenceModelsError):
    pass


class EnvironmentConfigurationError(BaseInferenceModelsError):
    pass


class ModelRuntimeError(BaseInferenceModelsError):
    pass


class ModelInputError(BaseInferenceModelsError):
    pass


class RetryError(BaseInferenceModelsError):
    pass


class RangeRequestNotSupportedError(BaseInferenceModelsError):
    """HTTP ranged GET did not return 206 Partial Content (threaded downloads)."""

    pass


class ModelRetrievalError(BaseInferenceModelsError):
    pass


class UntrustedFileError(BaseInferenceModelsError):
    pass


class FileHashSumMissmatch(BaseInferenceModelsError):
    pass


class ModelNotFoundError(ModelRetrievalError):
    pass


class UnauthorizedModelAccessError(ModelRetrievalError):
    pass


class PaymentRequiredModelAccessError(ModelRetrievalError):
    status_code = 402


class ForbiddenModelAccessError(ModelRetrievalError):
    status_code = 403


class UsagePausedModelAccessError(ModelRetrievalError):
    status_code = 423


class ModelMetadataConsistencyError(ModelRetrievalError):
    pass


class ModelMetadataHandlerNotImplementedError(ModelRetrievalError):
    pass


class InvalidEnvVariable(BaseInferenceModelsError):
    pass


class ModelPackageNegotiationError(BaseInferenceModelsError):
    pass


class UnknownBackendTypeError(ModelPackageNegotiationError):
    pass


class UnknownQuantizationError(ModelPackageNegotiationError):
    pass


class InvalidRequestedBatchSizeError(ModelPackageNegotiationError):
    pass


class RuntimeIntrospectionError(ModelPackageNegotiationError):
    pass


class JetsonTypeResolutionError(RuntimeIntrospectionError):
    pass


class NoModelPackagesAvailableError(ModelPackageNegotiationError):
    pass


class AmbiguousModelPackageResolutionError(ModelPackageNegotiationError):
    pass


class ModelLoadingError(BaseInferenceModelsError):
    pass


class ModelPackageAlternativesExhaustedError(ModelLoadingError):

    def __init__(
        self,
        message: str,
        help_url: Optional[str] = None,
        alternatives_errors: Optional[List[Exception]] = None,
    ):
        super().__init__(message, help_url)
        self._alternatives_errors = alternatives_errors

    @property
    def alternatives_errors(self) -> Optional[List[Exception]]:
        return self._alternatives_errors


class MissingModelInitParameterError(ModelLoadingError):
    pass


class InvalidModelInitParameterError(ModelLoadingError):
    pass


class InsecureModelIdentifierError(ModelLoadingError):
    pass


class DirectLocalStorageAccessError(ModelLoadingError):
    pass


class ForbiddenLocalCodePackageAccessError(ModelLoadingError):
    pass


class ModelImplementationNotFoundError(ModelLoadingError):
    pass


class CorruptedModelPackageError(ModelLoadingError):
    pass


class ModelPackageRestrictedError(ModelLoadingError):
    pass


class MissingDependencyError(BaseInferenceModelsError):
    pass


class InvalidParameterError(BaseInferenceModelsError):
    pass


class DependencyModelParametersValidationError(ModelLoadingError):
    pass


class ModelPipelineInitializationError(ModelLoadingError):
    pass


class ModelPipelineNotFound(ModelPipelineInitializationError):
    pass
