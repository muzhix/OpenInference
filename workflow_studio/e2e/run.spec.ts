import { expect, test } from "@playwright/test";

import { gotoEditor, seedDemoWorkflow } from "./helpers";

const TEST_IMAGE = "e2e/fixtures/test-image.jpg";

test.describe("Run panel execution (local engine)", () => {
  test.setTimeout(120_000);

  test("upload, run, thumbnails, rerun and edit input", async ({ page, request }) => {
    await seedDemoWorkflow(request, "run-demo");
    await gotoEditor(page, "run-demo");

    await page.getByRole("button", { name: "Open run panel" }).click();
    const panel = page.locator('aside[aria-label="Run workflow panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Test Your Workflow")).toBeVisible();

    // Hidden file input: commit the fixture image, then run.
    const runButton = panel.getByRole("button", { name: "Run Workflow" });
    await expect(runButton).toHaveAttribute("aria-disabled", "true");
    await page.setInputFiles('input[aria-label="Test image file"]', TEST_IMAGE);
    await expect(runButton).not.toHaveAttribute("aria-disabled", "true");
    await runButton.click();

    // Panel output image renders a decoded bitmap (engine contrast_enhancement).
    const outputImage = panel.locator('img[alt^="Workflow output image"]');
    await expect(outputImage).toBeVisible({ timeout: 60_000 });
    await expect
      .poll(async () => outputImage.evaluate((img) => (img as HTMLImageElement).naturalWidth), {
        timeout: 60_000,
      })
      .toBeGreaterThan(0);

    // Node-level thumbnail on the step card.
    const stepNode = page.locator(".react-flow__node").nth(1);
    await expect(stepNode.locator('img[alt="Run result"]')).toBeVisible();

    // Rerun with the same input keeps producing results.
    await panel.getByRole("button", { name: "Rerun workflow" }).click();
    await expect(outputImage).toBeVisible({ timeout: 60_000 });

    // Edit input returns to the input state.
    await panel.getByRole("button", { name: "Edit input" }).click();
    await expect(panel.getByText("Test Your Workflow")).toBeVisible();
  });
});
