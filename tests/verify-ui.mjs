import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/sawayamajunichi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];

page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));

await page.goto("http://localhost:4173", { waitUntil: "networkidle" });

const result = {
  title: await page.title(),
  pins: await page.locator(".pin").count(),
  metrics: await page.locator(".metric-card").count(),
  hasChart: await page.locator("#land-chart svg").count(),
  desktopScreenshot: "verification-desktop.png",
  mobileScreenshot: "verification-mobile.png"
};

await page.screenshot({ path: result.desktopScreenshot, fullPage: true });
await page.setViewportSize({ width: 393, height: 852 });
await page.waitForTimeout(300);
result.mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
await page.screenshot({ path: result.mobileScreenshot, fullPage: true });

await browser.close();

if (errors.length) {
  console.error(JSON.stringify({ ...result, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ...result, errors }, null, 2));
