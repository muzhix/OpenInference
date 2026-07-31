import type { Session } from "./session";

export type BlockDescription = {
  human_friendly_block_name: string;
  manifest_type_identifier: string;
  manifest_type_identifier_aliases?: string[];
  block_schema: Record<string, unknown>;
  outputs_manifest?: { name: string; kind?: unknown }[];
  block_source?: string;
};

export type BlocksDescribeResponse = {
  blocks: BlockDescription[];
};

export type CachedModel = {
  model_id: string;
  name?: string;
  task_type?: string;
  aliases?: string[];
  compatible_block_types?: string[];
};

export type WorkflowDocument = {
  id: string;
  name?: string;
  specification: WorkflowSpecification;
  ui?: { nodes: unknown[]; edges: unknown[] };
};

export type WorkflowSpecification = {
  version: string;
  inputs: Record<string, unknown>[];
  steps: Record<string, unknown>[];
  outputs: Record<string, unknown>[];
};

async function request<T>(
  session: Session,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (session.csrf) headers.set("X-CSRF", session.csrf);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${session.serverUrl}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${path}: ${text.slice(0, 400)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function describeBlocks(session: Session) {
  return request<BlocksDescribeResponse>(
    session,
    "/workflows/blocks/describe?air_gapped=true",
  );
}

export function listModels(session: Session) {
  return request<{ models: CachedModel[] }>(session, "/build/api/models");
}

export function listWorkflows(session: Session) {
  return request<{ data: Record<string, { config: WorkflowDocument }> }>(
    session,
    "/build/api",
  );
}

export function getWorkflow(session: Session, id: string) {
  return request<{ data: { config: WorkflowDocument } }>(
    session,
    `/build/api/${encodeURIComponent(id)}`,
  );
}

export function saveWorkflow(session: Session, id: string, doc: WorkflowDocument) {
  return request<unknown>(session, `/build/api/${encodeURIComponent(id)}`, {
    method: "POST",
    body: JSON.stringify(doc),
  });
}

export function deleteWorkflow(session: Session, id: string) {
  return request<unknown>(session, `/build/api/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function validateWorkflow(
  session: Session,
  specification: WorkflowSpecification,
) {
  return request<unknown>(session, "/workflows/validate", {
    method: "POST",
    body: JSON.stringify({ specification }),
  });
}

export function runWorkflow(
  session: Session,
  specification: WorkflowSpecification,
  inputs: Record<string, unknown>,
) {
  return request<unknown>(session, "/workflows/run", {
    method: "POST",
    body: JSON.stringify({ specification, inputs }),
  });
}
