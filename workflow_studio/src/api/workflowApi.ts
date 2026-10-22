/**
 * Typed /api/wf client per workflow_studio/README.md API contract table
 * (mirrors the measured cloud contracts in 08-api-contracts.md).
 */

import { apiGet, apiPost } from "./client";

import type { WorkflowSpecification } from "../types/spec";
import type { BlockRegistry } from "../types/registry";

export interface WorkflowSummary {
  id: string;
  url: string;
  name: string;
  owner?: string | null;
  createdByAI?: boolean;
  editedByAI?: boolean;
  createTime?: string | null;
  updateTime?: string | null;
  hasUnpublishedChanges?: boolean;
  published?: boolean;
}

export interface WorkflowDetail extends WorkflowSummary {
  /** Latest draft version config (specification object or JSON string). */
  config: WorkflowSpecification | string | null;
  /** Last published version config; null => never published. */
  lastVersionConfig: WorkflowSpecification | string | null;
}

export interface WorkflowSpecResponse {
  workflowSpec: {
    workflowId: string;
    workflowUrl: string;
    workspaceId?: string;
    versionId: string | null;
    config: WorkflowSpecification | string;
  };
}

export interface SaveDraftResponse {
  workflow: WorkflowSummary;
  version: {
    id: string;
    name: string;
    createdAt: string;
    config: WorkflowSpecification | string;
  };
}

export interface ValidationIssue {
  code: string;
  path?: string;
  message: string;
}

export interface ValidationResponse {
  errors?: ValidationIssue[];
  warnings?: ValidationIssue[];
}

export type SaveWorkflowPayload =
  | { id: string; publish: true }
  | { id: string; name?: string; url?: string }
  // `url` is optional for creation: the backend derives and dedupes the slug
  // from the name (custom-workflow, -2, ...) when it is omitted (01 §4b).
  | { name: string; url?: string; template?: string; config?: WorkflowSpecification }
  | { template: "duplicate"; sourceId: string; name?: string; url?: string };

/** Parse a config that the backend may return as an object or a JSON string. */
export function parseConfig(config: WorkflowSpecification | string | null): WorkflowSpecification | null {
  if (!config) {
    return null;
  }
  if (typeof config === "string") {
    try {
      return JSON.parse(config) as WorkflowSpecification;
    } catch {
      return null;
    }
  }
  return config;
}

export function fetchList(): Promise<{ workflows: WorkflowSummary[] }> {
  return apiGet<{ workflows: WorkflowSummary[] }>("/api/wf/list");
}

export function fetchGet(workflowUrl: string): Promise<{ workflow: WorkflowDetail }> {
  return apiGet<{ workflow: WorkflowDetail }>("/api/wf/get", { url: workflowUrl });
}

export function fetchSpec(workflowUrl: string): Promise<WorkflowSpecResponse> {
  return apiGet<WorkflowSpecResponse>("/api/wf/spec", { url: workflowUrl, preferDraft: "true" });
}

export function saveDraft(
  workflowId: string,
  config: WorkflowSpecification,
): Promise<SaveDraftResponse> {
  return apiPost<SaveDraftResponse>("/api/wf/saveDraft", { workflowId, config });
}

export function saveWorkflow(payload: SaveWorkflowPayload): Promise<{ workflow: WorkflowDetail }> {
  return apiPost<{ workflow: WorkflowDetail }>("/api/wf/save", payload);
}

export function validateSpec(config: WorkflowSpecification): Promise<ValidationResponse> {
  return apiPost<ValidationResponse>("/api/wf/validate", { config });
}

export function fetchRegistry(): Promise<BlockRegistry> {
  return apiGet<BlockRegistry>("/api/wf/registry");
}

/** GET /api/wf/configs?ids=... — bulk-fetch latest configs (ledger thumbnails, 01 §3). */
export function fetchConfigs(
  workflowIds: string[],
): Promise<{ configs: Record<string, WorkflowSpecification | string | null> }> {
  if (workflowIds.length === 0) {
    return Promise.resolve({ configs: {} });
  }
  return apiGet<{ configs: Record<string, WorkflowSpecification | string | null> }>("/api/wf/configs", {
    ids: workflowIds.join(","),
  });
}

/** POST /api/wf/delete — move workflows to the Trash (soft delete, 01 §4b). */
export function deleteWorkflows(workflowIds: string[]): Promise<{ deleted: string[] }> {
  return apiPost<{ deleted: string[] }>("/api/wf/delete", { workflowIds });
}

/** GET /api/wf/versions?url= — version-chain summaries, newest first. */
export interface WorkflowVersionSummary {
  id: string;
  name: string;
  createdAt: string;
  published: boolean;
  isLatest: boolean;
}

export interface WorkflowVersionDetail {
  id: string;
  name: string;
  createdAt: string;
  config: WorkflowSpecification | string;
}

/** GET /api/wf/versions?url= — list a workflow's version chain (C4). */
export function fetchVersions(
  workflowUrl: string,
): Promise<{ workflowId: string; workflowUrl: string; versions: WorkflowVersionSummary[] }> {
  return apiGet<{ workflowId: string; workflowUrl: string; versions: WorkflowVersionSummary[] }>(
    "/api/wf/versions",
    { url: workflowUrl },
  );
}

/** GET /api/wf/versions/{versionId} — one stored version with its config. */
export function fetchVersion(versionId: string): Promise<WorkflowVersionDetail> {
  return apiGet<WorkflowVersionDetail>(`/api/wf/versions/${encodeURIComponent(versionId)}`);
}

/** Image-like run input descriptor (06 §2: inline base64 or URL + precheck flag). */
export interface RunImageDescriptor {
  mediaType: "image";
  type: "base64" | "url";
  value: string;
  videoType: "file";
  /** Present only when the frontend HEAD precheck succeeded (06 §2b). */
  validUrl?: boolean;
}

export interface RunWorkflowResponse {
  /** Batch dimension: one record per inference request; keys align with spec outputs[].name. */
  outputs: Record<string, unknown>[];
  profiler_trace: unknown[];
}

/** POST /api/wf/run — execute a specification through the local engine. */
export function runWorkflow(
  specification: WorkflowSpecification,
  inputs: Record<string, unknown>,
): Promise<RunWorkflowResponse> {
  return apiPost<RunWorkflowResponse>("/api/wf/run", { specification, inputs });
}
