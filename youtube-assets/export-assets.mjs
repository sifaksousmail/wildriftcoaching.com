import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(__dirname);

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    const candidates = [
      join(repoRoot, "youtube-intro", "node_modules", "playwright", "index.mjs"),
      join(repoRoot, "youtube-outro", "node_modules", "playwright", "index.mjs")
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return import(pathToFileURL(candidate).href);
      }
    }
  }

  throw new Error("Playwright is not installed. Run npm install in youtube-assets, then npm run export.");
}

const { chromium } = await loadPlaywright();

const pageUrl = pathToFileURL(join(__dirname, "index.html")).href;
const outputs = [
  {
    asset: "thumbnail",
    selector: ".thumbnail-artboard",
    width: 1280,
    height: 720,
    output: join(__dirname, "thumbnail-wildrift-01.png")
  },
  {
    asset: "profile",
    selector: ".profile-artboard",
    width: 800,
    height: 800,
    output: join(__dirname, "profile-picture.png")
  },
  {
    asset: "banner",
    selector: ".banner-artboard",
    width: 2048,
    height: 1152,
    output: join(__dirname, "youtube-channel-banner.png")
  },
  {
    asset: "banner-guide",
    selector: ".banner-guide-artboard",
    width: 2048,
    height: 1152,
    output: join(__dirname, "youtube-channel-banner-safe-area-guide.png")
  }
];

const browser = await chromium.launch();

for (const item of outputs) {
  const page = await browser.newPage({
    viewport: { width: item.width, height: item.height },
    deviceScaleFactor: 1
  });

  await page.goto(`${pageUrl}?asset=${item.asset}`);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts?.ready);
  await page.locator(item.selector).screenshot({ path: item.output });
  console.log(`Created ${item.output}`);
  await page.close();
}

await browser.close();
