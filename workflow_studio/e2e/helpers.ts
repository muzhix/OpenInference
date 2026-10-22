/**
 * Shared E2E helpers: hermetic seeding over the /api/wf API (the specs own
 * their data) plus navigation shorthands. API paths are root-relative so they
 * resolve against the server root even though the app baseURL is /studio.
 */

import { expect } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

import demoSpec from "./fixtures/demo-spec.json" with { type: "json" };

export const DEMO_SPEC: Record<string, unknown> = demoSpec;

export interface SeededWorkflow {
  id: string;
  url: string;
  name: string;
}

async function postJson(
  request: APIRequestContext,
  path: string,
  data: unknown,
): Promise<Record<string, unknown>> {
  const response = await request.post(path, { data });
  expect(response.status(), `${path} responded`).toBe(200);
  return (await response.json()) as Record<string, unknown>;
}

/** POST /api/wf/save — create (optionally with an initial config). */
export async function createWorkflow(
  request: APIRequestContext,
  payload: { name: string; url?: string; config?: unknown },
): Promise<SeededWorkflow> {
  const body = await postJson(request, "/api/wf/save", payload);
  const workflow = body.workflow as SeededWorkflow;
  expect(workflow.id).toBeTruthy();
  return workflow;
}

/** POST /api/wf/save — publish the latest version of a workflow. */
export async function publishWorkflow(
  request: APIRequestContext,
  workflowId: string,
): Promise<void> {
  const body = await postJson(request, "/api/wf/save", { id: workflowId, publish: true });
  expect((body.workflow as { published: boolean }).published).toBe(true);
}

/** POST /api/wf/saveDraft — append a new draft version. */
export async function saveDraft(
  request: APIRequestContext,
  workflowId: string,
  config: unknown,
): Promise<void> {
  const body = await postJson(request, "/api/wf/saveDraft", { workflowId, config });
  expect((body.version as { id: string }).id).toBeTruthy();
}

/** Seed the canonical demo workflow (Inputs → contrast_enhancement → Outputs). */
export async function seedDemoWorkflow(
  request: APIRequestContext,
  url: string,
): Promise<SeededWorkflow> {
  return createWorkflow(request, { name: url, url, config: DEMO_SPEC });
}

export async function gotoLedger(page: Page): Promise<void> {
  await page.goto("/studio/workflows");
  await expect(page.getByRole("button", { name: "Create workflow" })).toBeVisible();
}

export async function gotoEditor(page: Page, slug: string): Promise<void> {
  await page.goto(`/studio/build?workflowUrl=${encodeURIComponent(slug)}`);
  await expect(page.getByRole("button", { name: "Save workflow draft" })).toBeVisible();
}

/** Open the ⋯ menu of a ledger card and click one of its actions. */
export async function runCardAction(
  page: Page,
  workflowName: string,
  action: "Duplicate Workflow" | "Rename Workflow…" | "Move to Trash",
): Promise<void> {
  const card = page.locator(`article[aria-label="Open workflow ${workflowName}"]`);
  await card.hover();
  await card.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("menuitem", { name: action }).click();
}
