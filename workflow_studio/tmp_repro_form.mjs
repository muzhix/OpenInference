import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", args: ["--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
await page.goto("http://localhost:9417/studio/build?workflowUrl=cloud-style-demo", { waitUntil: "networkidle" });
await page.waitForSelector(".react-flow__node");
await page.waitForTimeout(600);

const facts = {};
const dump = async (label) => {
  facts[label] = await page.evaluate(() => {
    const card = document.querySelector('[data-id="$inputs"]');
    const form = card?.querySelector("[data-input-form]");
    if (!form) return { formOpen: false };
    const chipEls = [...card.querySelectorAll(".group\\/item > span[title]")];
    const fields = [...form.querySelectorAll("label > span, div > span.mb-1")].map(s => s.textContent.trim());
    const nameInput = form.querySelector('input[aria-label="New input name"]');
    const typeBtn = form.querySelector('[aria-label="Select input type"]');
    const kindBtn = form.querySelector('[aria-label="Select default value type"]');
    const defInput = form.querySelector('input[aria-label="Default value"]');
    const btns = [...form.querySelectorAll("button")].filter(b => ["Cancel","Add"].includes(b.textContent.trim()));
    const styleOf = (el) => el ? getComputedStyle(el) : null;
    const addBtn = btns.find(b => b.textContent.trim() === "Add");
    const cancelBtn = btns.find(b => b.textContent.trim() === "Cancel");
    const addS = addBtn ? styleOf(addBtn) : null;
    const cancelS = cancelBtn ? styleOf(cancelBtn) : null;
    return {
      formOpen: true,
      chips: chipEls.map(c => c.textContent.trim()),
      labels: fields,
      nameValue: nameInput?.value,
      namePlaceholder: nameInput?.placeholder,
      typeTriggerText: typeBtn?.textContent.trim(),
      typeTriggerClasses: typeBtn?.className,
      kindTriggerText: kindBtn?.textContent.trim(),
      defValue: defInput?.value,
      defPlaceholder: defInput?.placeholder,
      addDisabled: addBtn?.disabled,
      addBg: addS?.backgroundColor, addColor: addS?.color, addOpacity: addS?.opacity,
      cancelBorder: cancelS?.borderWidth + " " + cancelS?.borderColor, cancelBg: cancelS?.backgroundColor,
      formPanel: getComputedStyle(form).borderWidth + "/" + getComputedStyle(form).borderRadius,
    };
  });
};

// state 1: initial
await page.locator('[data-id="$inputs"] button[aria-label="Add input"]').click();
await page.waitForTimeout(250);
await dump("initial");
await page.screenshot({ path: "/tmp/repro-initial.png" });

// state 2: type menu open
await page.locator('[aria-label="Select input type"]').click();
await page.waitForTimeout(250);
const menuFacts = await page.evaluate(() => {
  const card = document.querySelector('[data-id="$inputs"]');
  const menus = [...card.querySelectorAll("[data-input-form] .absolute.z-30")];
  return menus.map(m => ({
    opts: [...m.querySelectorAll("button")].map(b => b.textContent.trim()),
    bg: getComputedStyle(m).backgroundColor,
    shadow: getComputedStyle(m).boxShadow.slice(0, 60),
    radius: getComputedStyle(m).borderRadius,
    border: getComputedStyle(m).borderColor,
  }));
});
facts.typeMenu = menuFacts;
await page.screenshot({ path: "/tmp/repro-type-menu.png" });
await page.keyboard.press("Escape");
await page.evaluate(() => document.activeElement?.blur());
await page.mouse.click(20, 500);
await page.waitForTimeout(200);

// state 3: choose Parameter, then open kind menu
await page.locator('[aria-label="Select input type"]').click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Parameter", exact: true }).click();
await page.waitForTimeout(200);
await dump("param-selected");
await page.locator('[aria-label="Select default value type"]').click();
await page.waitForTimeout(250);
const kindMenuFacts = await page.evaluate(() => {
  const card = document.querySelector('[data-id="$inputs"]');
  const menus = [...card.querySelectorAll("[data-input-form] .absolute.z-30")];
  return menus.map(m => ({
    opts: [...m.querySelectorAll("button")].map(b => b.textContent.trim()),
    bg: getComputedStyle(m).backgroundColor,
    radius: getComputedStyle(m).borderRadius,
  }));
});
facts.kindMenu = kindMenuFacts;
await page.screenshot({ path: "/tmp/repro-kind-menu.png" });
await page.mouse.click(20, 500);
await page.waitForTimeout(200);

// state 4: fill confidence + number + 0.5
await page.locator('input[aria-label="New input name"]').fill("confidence");
await page.locator('[aria-label="Select default value type"]').click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "number", exact: true }).click();
await page.waitForTimeout(150);
await page.locator('input[aria-label="Default value"]').fill("0.5");
await page.waitForTimeout(250);
await dump("filled");
await page.screenshot({ path: "/tmp/repro-filled.png" });

console.log(JSON.stringify(facts, null, 1));
await browser.close();
