import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", args: ["--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
await page.goto("http://localhost:9417/studio/build?workflowUrl=cloud-style-demo", { waitUntil: "networkidle" });
await page.waitForSelector(".react-flow__node");
await page.waitForTimeout(500);
await page.locator('[data-id="$inputs"] button[aria-label="Add input"]').click();
await page.waitForTimeout(200);
await page.locator('[aria-label="Select input type"]').click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Parameter", exact: true }).click();
await page.waitForTimeout(200);
await page.locator('input[aria-label="New input name"]').fill("confidence");
await page.locator('input[aria-label="Default value"]').fill("0.5");
await page.waitForTimeout(200);
const boxes = await page.evaluate(() => {
  const card = document.querySelector('[data-id="$inputs"]');
  const form = card.querySelector("[data-input-form]");
  const out = { card: card.getBoundingClientRect().toJSON(), form: form.getBoundingClientRect().toJSON(), items: [] };
  const els = [
    ["title", card.querySelector(".text-sm.font-medium")],
    ["subtitle", card.querySelector(".text-\\[10px\\]")],
    ["chip", card.querySelector(".group\\/item")],
    ["NameLabel", [...form.querySelectorAll("span")].find(s => s.textContent.trim() === "Name")],
    ["nameInput", form.querySelector('input[aria-label="New input name"]')],
    ["TypeLabel", [...form.querySelectorAll("span")].find(s => s.textContent.trim() === "Type")],
    ["typeTrigger", form.querySelector('[aria-label="Select input type"] > span')],
    ["DefLabel", [...form.querySelectorAll("span")].find(s => s.textContent.trim() === "Default value")],
    ["kindTrigger", form.querySelector('[aria-label="Select default value type"] > span')],
    ["defInput", form.querySelector('input[aria-label="Default value"]')],
    ["cancelBtn", [...form.querySelectorAll("button")].find(b => b.textContent.trim() === "Cancel")],
    ["addBtn", [...form.querySelectorAll("button")].find(b => b.textContent.trim() === "Add")],
  ];
  for (const [k, el] of els) {
    if (!el) { out.items.push([k, null]); continue; }
    const r = el.getBoundingClientRect();
    out.items.push([k, { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }]);
  }
  return out;
});
console.log(JSON.stringify(boxes, null, 1));
await browser.close();
