import { expect, test } from "@playwright/test";

import { gotoEditor, seedDemoWorkflow } from "./helpers";

test.describe("Workflow editor canvas", () => {
  // One workflow per test: explicit slugs cannot be recreated within one run.
  test("nodes render, select, and double-click opens the config form", async ({ page, request }) => {
    await seedDemoWorkflow(request, "editor-select");
    await gotoEditor(page, "editor-select");

    const nodes = page.locator(".react-flow__node");
    await expect(nodes).toHaveCount(3);

    const stepNode = nodes.nth(1);
    await stepNode.click();
    await expect(stepNode).toHaveClass(/selected/);

    await stepNode.dblclick();
    await expect(stepNode.getByLabel("Step name")).toBeVisible();
    // Cloud visibility rule: only the required selector row shows by default…
    await expect(stepNode.getByText("Input Image")).toBeVisible();
    // …optional fields wait behind the collapsed additional-properties toggle.
    await expect(stepNode.getByText("Contrast Multiplier")).toBeHidden();
    await stepNode.getByRole("button", { name: "Show additional properties" }).click();
    await expect(stepNode.getByText("Contrast Multiplier")).toBeVisible();
  });

  test("add block from the palette binds the input, adds an output, and undo/redo round-trips", async ({ page, request }) => {
    await seedDemoWorkflow(request, "editor-palette");
    await gotoEditor(page, "editor-palette");

    const nodes = page.locator(".react-flow__node");
    await expect(nodes).toHaveCount(3);
    const edges = page.locator('[aria-label^="Edge from"]');
    await expect(edges).toHaveCount(2);
    const edgesBefore = await edges.count();

    await page.getByRole("button", { name: "Add block" }).click();
    await page.getByLabel("Search blocks").fill("Contrast");
    await page.getByTestId("blockListItem").first().click();

    await expect(nodes).toHaveCount(4);
    // New step auto-binds $inputs.image (edge from Inputs) and auto-generates
    // a JsonField output (edge to Outputs): +2 edges.
    await expect(edges).toHaveCount(edgesBefore + 2);
    // New step auto-generates a JsonField output in the outputs node.
    await expect(nodes.nth(3).getByText(/_output$/)).toBeVisible();

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(nodes).toHaveCount(3);

    await page.getByRole("button", { name: "Redo" }).click();
    await expect(nodes).toHaveCount(4);

    // Keyboard shortcuts (Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z redo) round-trip too.
    await page.keyboard.press("Control+z");
    await expect(nodes).toHaveCount(3);
    await page.keyboard.press("Control+Shift+z");
    await expect(nodes).toHaveCount(4);
  });

  test("saving persists the added node across reload", async ({ page, request }) => {
    await seedDemoWorkflow(request, "editor-save");
    await gotoEditor(page, "editor-save");

    await page.getByRole("button", { name: "Add block" }).click();
    await page.getByLabel("Search blocks").fill("Contrast");
    await page.getByTestId("blockListItem").first().click();

    const saveButton = page.getByRole("button", { name: "Save workflow draft" });
    await expect(saveButton).not.toHaveAttribute("aria-disabled", "true");
    await saveButton.click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.locator(".react-flow__node")).toHaveCount(4);
  });

  test("Backspace and Delete remove selected steps; dangling output blocks saving", async ({ page, request }) => {
    await seedDemoWorkflow(request, "editor-delete");
    await gotoEditor(page, "editor-delete");

    // Two step nodes: add one more so both keys can be exercised.
    await page.getByRole("button", { name: "Add block" }).click();
    await page.getByLabel("Search blocks").fill("Contrast");
    await page.getByTestId("blockListItem").first().click();
    const nodes = page.locator(".react-flow__node");
    await expect(nodes).toHaveCount(4);

    // Delete the added node with Backspace.
    await nodes.nth(2).click();
    await page.keyboard.press("Backspace");
    await expect(nodes).toHaveCount(3);

    // Delete the last remaining step with Delete; its output turns dangling.
    await nodes.nth(1).click();
    await page.keyboard.press("Delete");
    await expect(nodes).toHaveCount(2);

    const validation = page.locator('[aria-label="Validation status"]');
    await expect(validation).toBeVisible();
    await expect(validation).toContainText(/Dangling reference/i);
    await expect(
      page.getByRole("button", { name: "Save workflow draft" }),
    ).toHaveAttribute("aria-disabled", "true");
  });
});
