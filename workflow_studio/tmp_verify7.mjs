import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", args: ["--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 1760, height: 980 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 150)); });
await page.goto("http://127.0.0.1:9001/studio/build?workflowUrl=cloud-style-demo", { waitUntil: "networkidle" });
await page.waitForSelector(".react-flow__node");
await page.waitForTimeout(600);
// icons after robust parser: inputs header icon + chip edit/delete glyphs
const inputsNode = page.locator('[data-id="$inputs"]');
const headerIcon = await inputsNode.locator(".h-10 > i").evaluate(el => el.className.toString());
console.log("inputs header icon:", headerIcon);
const chipIcon = await inputsNode.locator(".group\\/item > i").first().evaluate(el => el.className.toString());
const editBtnIcon = await inputsNode.getByLabel("Rename input image").locator("i").evaluate(el => el.className.toString());
console.log("chip icon:", chipIcon, "| edit btn:", editBtnIcon);
// hollow question icon (svg, no fa)
const qCount = await inputsNode.locator("svg").count();
console.log("inputs svg (hollow ?):", qCount >= 1);
// mask: select step node -> others dim + unclickable
const stepNode = page.locator('[data-id="$steps.object_detection_model"]');
await stepNode.click();
await page.waitForTimeout(400);
const dim = await inputsNode.evaluate(el => getComputedStyle(el).opacity);
const clickable = await inputsNode.evaluate(el => getComputedStyle(el).pointerEvents);
console.log("dimmed inputs opacity:", dim, "| pointer-events:", clickable);
try { await inputsNode.click({ timeout: 2000 }); } catch { /* blocked expected */ }
await page.waitForTimeout(200);
console.log("selection stayed on step:", await page.locator(".react-flow__node.selected").getAttribute("data-id"));
// expanded accent block
const accent = await stepNode.locator(".absolute.bottom-0.left-0").first().evaluate(el => ({ bg: getComputedStyle(el).backgroundColor, w: el.getBoundingClientRect().width }));
console.log("expanded accent:", JSON.stringify(accent));
await page.screenshot({ path: "/tmp/wf_v2_step_expanded.png" });
// unbind image chip -> picker button -> open popover -> pick inputs.image
await stepNode.getByLabel("Clear Image").click();
await page.waitForTimeout(300);
console.log("picker button:", await stepNode.getByLabel("Image selector").isVisible());
await stepNode.getByLabel("Image selector").click();
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/wf_v2_picker.png" });
await page.locator('[title="$inputs.image"]').click();
await page.waitForTimeout(300);
console.log("rebound chip:", await stepNode.locator('[data-field-name="image"] .drop-zone-base span').first().textContent());
// deselect via pane click -> dim gone
await page.mouse.click(900, 700);
await page.waitForTimeout(300);
console.log("after pane click inputs opacity:", await inputsNode.evaluate(el => getComputedStyle(el).opacity));
console.log("CONSOLE ERRORS:", errors.length ? errors : "none");
await page.screenshot({ path: "/tmp/wf_v2_final.png" });
await browser.close();
