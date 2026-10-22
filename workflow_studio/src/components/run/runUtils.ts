/**
 * Pure helpers for the run panel (06-run-panel-and-execution.md): run input
 * construction, step-thumbnail derivation from spec selectors, and result
 * value classification for the output area. No DOM or fetch here.
 */

import { parseSelector } from "../../adapter";
import type { WorkflowSpecification } from "../../types/spec";
import type { RunImageDescriptor } from "../../api/workflowApi";

/** A committed test input shown in the panel and sent to /api/wf/run. */
export interface RunImageInput {
  kind: "base64" | "url";
  /** base64 payload without the data-url prefix, or the bare URL. */
  value: string;
  /** Full data URL (base64 kind) kept for local preview rendering. */
  dataUrl?: string;
  fileName?: string;
  /** Committed file size in bytes (file kind only, for the preview caption). */
  sizeBytes?: number;
  /** URL kind only: the HEAD precheck succeeded (06 §2b). */
  validUrl?: boolean;
}

const DATA_URL_PREFIX_RE = /^data:[^;,]*;base64,(.*)$/s;

/** Strip a `data:<mime>;base64,` prefix; non-data-URL values pass through. */
export function stripDataUrlPrefix(value: string): string {
  const match = DATA_URL_PREFIX_RE.exec(value);
  return match ? match[1]! : value;
}

/**
 * Build the `inputs` payload for POST /api/wf/run (06 §2/§2b). `validUrl` is
 * only sent when the URL precheck succeeded; the base64 form never carries it.
 */
export function buildRunInputs(input: RunImageInput): { image: RunImageDescriptor } {
  const descriptor: RunImageDescriptor = {
    mediaType: "image",
    type: input.kind,
    value: input.value,
    videoType: "file",
  };
  if (input.kind === "url" && input.validUrl === true) {
    return { image: { ...descriptor, validUrl: true } };
  }
  return { image: descriptor };
}

/** Engine-serialized image (base64 JPEG/PNG payload, 06 §2 response). */
export interface RunImageValue {
  type: "base64";
  value: string;
  height?: number;
  width?: number;
}

export function isImageValue(value: unknown): value is RunImageValue {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.type === "base64" && typeof record.value === "string";
}

/** Data URL usable directly in an <img src> for an image-like run output. */
export function imageSrc(value: RunImageValue): string {
  return `data:image/jpeg;base64,${value.value}`;
}

/** supervision sv.Detections serialization (06 §2 response shape). */
export interface PredictionItem {
  class?: string;
  class_id?: number | null;
  confidence?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  detection_id?: string;
  [key: string]: unknown;
}

export interface PredictionsValue {
  image?: { width?: number; height?: number };
  predictions: PredictionItem[];
}

export function isPredictionsValue(value: unknown): value is PredictionsValue {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return Array.isArray(record.predictions);
}

/** Scalars render as big text (number/bool/short string, 06 §5). */
const SCALAR_STRING_LIMIT = 80;

export function isScalarValue(value: unknown): boolean {
  if (typeof value === "number" || typeof value === "boolean") {
    return true;
  }
  return typeof value === "string" && value.length <= SCALAR_STRING_LIMIT;
}

/** Format a byte count for the committed-file caption. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Map step names to result thumbnails (D3): for every spec output whose
 * selector points at `$steps.<name>.<output>` and whose run value is an image,
 * record the step name -> displayable data URL (06 §3 node-level thumbnails).
 */
export function deriveStepThumbnails(
  spec: WorkflowSpecification,
  outputs: Record<string, unknown>,
): Record<string, string> {
  const thumbnails: Record<string, string> = {};
  for (const output of spec.outputs ?? []) {
    const parsed = parseSelector(output.selector ?? "");
    if (!parsed || parsed.scope !== "steps" || !parsed.stepName) {
      continue;
    }
    const value = outputs[output.name];
    if (isImageValue(value)) {
      thumbnails[parsed.stepName] = imageSrc(value);
    }
  }
  return thumbnails;
}

/** Extract a user-facing message from a run failure (422 body: errors[0].message). */
export function extractRunErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "payload" in error) {
    const payload = (error as { payload?: unknown }).payload;
    if (payload && typeof payload === "object") {
      const errors = (payload as Record<string, unknown>).errors;
      if (Array.isArray(errors) && errors.length > 0) {
        const first = errors[0] as Record<string, unknown> | null;
        if (first && typeof first.message === "string") {
          return first.message;
        }
      }
    }
  }
  return error instanceof Error ? error.message : String(error);
}

/** Output names in spec order, then any extra response keys (D3 alignment). */
export function orderedOutputNames(
  spec: WorkflowSpecification | null,
  outputs: Record<string, unknown>,
): string[] {
  const names = new Set<string>();
  for (const output of spec?.outputs ?? []) {
    if (output.name in outputs) {
      names.add(output.name);
    }
  }
  for (const key of Object.keys(outputs)) {
    names.add(key);
  }
  return [...names];
}
