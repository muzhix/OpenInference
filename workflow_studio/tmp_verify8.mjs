import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", args: ["--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 1760, height: 980 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 150)); });
await page.goto("http://127.0.0.1:9001/studio/build?workflowUrl=cloud-style-demo", { waitUntil: "networkidle" });
await page.waitForSelector(".react-flow__node");
await page.waitForTimeout(600);
const inputsNode = page.locator('[data-id="$inputs"]');
const stepNode = page.locator('[data-id="$steps.object_detection_model"]');
await stepNode.click();
await page.waitForTimeout(400);
const dim = await inputsNode.evaluate(el => getComputedStyle(el).opacity);
const pe = await inputsNode.evaluate(el => getComputedStyle(el).pointerEvents);
console.log("dim:", dim, "| pe:", pe);
try { await inputsNode.click({ timeout: 1500 }); console.log("clicked through (BAD)"); } catch { console.log("click blocked (expected)"); }
console.log("selection:", await page.locator(".react-flow__node.selected").getAttribute("data-id"));
const accent = await stepNode.locator(".absolute.bottom-0.left-0").first().evaluate(el => ({ bg: getComputedStyle(el).backgroundColor, w: Math.round(el.getBoundingClientRect().width) }));
console.log("expanded accent:", JSON.stringify(accent));
await page.screenshot({ path: "/tmp/wf_v3_step.png" });
// picker flow: clear -> button -> popover -> pick inputs.image
await stepNode.getByLabel("Clear Image").click();
await page.waitForTimeout(300);
await stepNode.getByLabel("Image selector").click();
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/wf_v3_picker.png" });
await page.locator('[title="$inputs.image"]').click();
await page.waitForTimeout(300);
console.log("rebound:", (await stepNode.locator('[data-field-name="image"] .drop-zone-base span').first().textContent())?.trim());
// deselect via pane -> undim
await page.mouse.click(900, 640);
await page.waitForTimeout(300);
console.log("undim after pane click:", await inputsNode.evaluate(el => getComputedStyle(el).opacity));
console.log("CONSOLE ERRORS:", errors.length ? errors : "none");
await browser.close();
