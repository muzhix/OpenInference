import { expect, test } from "@playwright/test";

import { gotoEditor, seedDemoWorkflow } from "./helpers";

const ENDPOINT = "http://127.0.0.1:9112/api/wf/run";

test.describe("Publish and Use", () => {
  test("publish flips the banner, unlocks Use with snippets; drafts revert the banner; history lists versions", async ({ page, request }) => {
    const workflow = await seedDemoWorkflow(request, "publish-demo");
    await gotoEditor(page, "publish-demo");

    // Draft state: amber "not published yet" banner, Use locked.
    await expect(page.getByText("Draft saved — not published yet")).toBeVisible();
    const useButton = page.getByRole("button", { name: "Use workflow" });
    await expect(useButton).toHaveAttribute("aria-disabled", "true");

    // Publish: no confirmation dialog, banner turns green "Published".
    await page.getByRole("button", { name: "Publish workflow" }).click();
    await expect(
      page.locator("div[aria-live='polite']").filter({ hasText: "✓ Published" }),
    ).toBeVisible();
    await expect(useButton).not.toHaveAttribute("aria-disabled", "true");

    // Use modal: endpoint URL + inlined spec (its "version") in both snippets.
    await useButton.click();
    const modal = page.locator('div[role="dialog"][aria-label="Use Workflow"]');
    await expect(modal).toBeVisible();
    const curl = modal.locator('section[aria-label="curl code snippet"]');
    await expect(curl).toContainText(ENDPOINT);
    await expect(curl).toContainText('"version"');
    const python = modal.locator('section[aria-label="python code snippet"]');
    await expect(python).toContainText(ENDPOINT);
    await expect(python).toContainText('"version"');
    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);

    // Save a draft change on the published workflow: banner back to amber.
    const stepNode = page.locator(".react-flow__node").nth(1);
    await stepNode.dblclick();
    // Optional fields hide behind the additional-properties toggle (cloud rule).
    await stepNode.getByRole("button", { name: "Show additional properties" }).click();
    // Exact: the stepper buttons carry Increase/Decrease Contrast Multiplier labels.
    await stepNode.getByLabel("Contrast Multiplier", { exact: true }).fill("2.5");
    const saveButton = page.getByRole("button", { name: "Save workflow draft" });
    await expect(saveButton).not.toHaveAttribute("aria-disabled", "true");
    await saveButton.click();
    await expect(
      page.locator("div[aria-live='polite']").filter({ hasText: "Saved changes are not live yet" }),
    ).toBeVisible();

    // Version history: initial version + the saved draft = 2 rows; a row opens JSON.
    await page.getByRole("button", { name: "Version history" }).click();
    const history = page.locator('div[role="dialog"][aria-label="Version history"]');
    await expect(history).toBeVisible();
    const versionRows = history.getByRole("button", { name: /Show version Draft saved on/ });
    await expect(versionRows).toHaveCount(2);
    await versionRows.last().click();
    await expect(history.locator('[aria-label="Version config JSON"]')).toContainText('"version"');
    await expect(history.getByRole("button", { name: "Restore version" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    // The history chain is backed by the real API data.
    const response = await request.get(`/api/wf/versions?url=${workflow.url}`);
    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload.versions.length).toBeGreaterThanOrEqual(2);
  });
});
