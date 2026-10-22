import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", args: ["--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 1760, height: 980 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 150)); });
await page.goto("http://127.0.0.1:9001/studio/build?workflowUrl=cloud-style-demo", { waitUntil: "networkidle" });
await page.waitForSelector(".react-flow__node");
await page.waitForTimeout(600);
const step = page.locator('[data-id="$steps.object_detection_model"]');
const inputs = page.locator('[data-id="$inputs"]');
// 1) click toggles open
await step.click();
await page.waitForTimeout(300);
const open1 = await step.locator("[data-field-name]").count();
console.log("click1 open fields:", open1 > 0);
// click again on node BODY (header title area, not a control) -> close
await step.locator(".text-\\[11px\\]").first().click();
await page.waitForTimeout(300);
const open2 = await step.locator("[data-field-name]").count();
console.log("click2 closed:", open2 === 0);
// drag does not toggle
await step.click();
await page.waitForTimeout(250);
const box = await step.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + 30);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 120, box.y + 30, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(400);
console.log("after drag still open:", (await step.locator("[data-field-name]").count()) > 0, "| moved:", Math.abs((await step.boundingBox()).x - box.x) > 50);
// 2) accent block visible + icon chip
const accent = await step.locator(".absolute.bottom-0.left-0").first().evaluate(el => ({ bg: getComputedStyle(el).backgroundColor, w: Math.round(el.getBoundingClientRect().width) }));
console.log("accent:", JSON.stringify(accent));
const chipOnAccent = await step.locator(".absolute.left-\\[9px\\]").count();
console.log("icon chip on accent:", chipOnAccent === 1);
await page.screenshot({ path: "/tmp/wf_v4_expanded.png" });
// 3) auto layout gap with expanded node: measure inputs bottom handle vs step top
await page.getByRole("button", { name: "Auto layout", exact: true }).click();
await page.waitForTimeout(500);
const inBox = await inputs.boundingBox();
const stBox = await step.boundingBox();
console.log("gap inputs-bottom→step-top:", Math.round(stBox.y - (inBox.y + inBox.height)));
// 4) hollow icons: toolbar + action bar svg count, no fa-cube in chrome
const svgToolbar = await page.locator('[role="toolbar"] svg').count();
const faToolbar = await page.locator('[role="toolbar"] i[class*="fa-"]').count();
console.log("toolbar svg:", svgToolbar, "| toolbar fa:", faToolbar);
console.log("CONSOLE ERRORS:", errors.length ? errors : "none");
await page.screenshot({ path: "/tmp/wf_v4_final.png" });
await browser.close();
