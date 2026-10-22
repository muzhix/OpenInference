import { expect, test } from "@playwright/test";

import { createWorkflow, gotoLedger, publishWorkflow, runCardAction } from "./helpers";

test.describe("Workflows ledger", () => {
  test("Create Workflow button lands in the editor", async ({ page }) => {
    await gotoLedger(page);

    await page.getByRole("button", { name: "Create workflow" }).click();

    await expect(page).toHaveURL(/\/studio\/build\?workflowUrl=custom-workflow$/);
    await expect(page.locator('main[aria-label="Workflow canvas"]')).toBeVisible();
    await expect(page).toHaveTitle(/Custom Workflow/);
  });

  test("cards show publish-state badges and search filters the grid", async ({ page, request }) => {
    const published = await createWorkflow(request, {
      name: "Ledger Published",
      url: "ledger-published",
    });
    await createWorkflow(request, { name: "Ledger Draft", url: "ledger-draft" });
    await publishWorkflow(request, published.id);

    await gotoLedger(page);

    const publishedCard = page.locator('article[aria-label="Open workflow Ledger Published"]');
    await expect(publishedCard.getByText("Published", { exact: true })).toBeVisible();
    const draftCard = page.locator('article[aria-label="Open workflow Ledger Draft"]');
    await expect(draftCard.getByText("Draft", { exact: true })).toBeVisible();

    await page.getByLabel("Search workflows").fill("Ledger Draft");
    await expect(publishedCard).toHaveCount(0);
    await expect(draftCard).toBeVisible();
  });

  test("rename via the card menu persists after refresh", async ({ page, request }) => {
    await createWorkflow(request, { name: "Rename Me", url: "rename-me" });
    await gotoLedger(page);

    await runCardAction(page, "Rename Me", "Rename Workflow…");
    await page.locator("#rename-workflow-name").fill("Rename Me Now");
    await page.getByRole("button", { name: "Save workflow name" }).click();

    await expect(
      page.locator('article[aria-label="Open workflow Rename Me Now"]'),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.locator('article[aria-label="Open workflow Rename Me Now"]'),
    ).toBeVisible();
  });

  test("trash requires the exact slug and removes the card", async ({ page, request }) => {
    await createWorkflow(request, { name: "Trash Target", url: "trash-target" });
    await gotoLedger(page);

    await runCardAction(page, "Trash Target", "Move to Trash");
    const deleteButton = page.getByRole("button", { name: "Move workflow to trash" });

    await page.locator("#trash-confirmation").fill("wrong-slug");
    await expect(deleteButton).toHaveAttribute("aria-disabled", "true");

    await page.locator("#trash-confirmation").fill("trash-target");
    await expect(deleteButton).not.toHaveAttribute("aria-disabled", "true");
    await deleteButton.click();

    await expect(
      page.locator('article[aria-label="Open workflow Trash Target"]'),
    ).toHaveCount(0);
  });

  test("duplicate via the card menu creates a '… 2' card", async ({ page, request }) => {
    await createWorkflow(request, { name: "Duplicand", url: "duplicand" });
    await gotoLedger(page);

    await runCardAction(page, "Duplicand", "Duplicate Workflow");

    await expect(
      page.locator('article[aria-label="Open workflow Duplicand 2"]'),
    ).toBeVisible();
    await expect(
      page.locator('article[aria-label="Open workflow Duplicand"]'),
    ).toBeVisible();
  });
});
