import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fps = Number(process.env.FPS || 30);
const width = 1920;
const height = 1080;
const framesDir = join(__dirname, "frames");
const output = join(__dirname, "wildriftcoaching-intro.mp4");
const audio = join(__dirname, "assets", "eyes-patrick-jordan-patrikios.mp3");

rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
const introUrl = `${pathToFileURL(join(__dirname, "index.html")).href}?export=1&framecapture=1`;
await page.goto(introUrl);
await page.waitForLoadState("networkidle");
await page.waitForFunction(() => (
  document.documentElement.classList.contains("is-exporting") &&
  window.__setIntroTime &&
  getComputedStyle(document.querySelector(".intro-controls")).display === "none"
));

const duration = await page.evaluate(() => window.__INTRO_DURATION_SECONDS || 7.2);
const totalFrames = Math.round(duration * fps);

for (let frame = 0; frame <= totalFrames; frame += 1) {
  const time = frame / fps;
  await page.evaluate((value) => window.__setIntroTime(value), time);
  await page.screenshot({
    path: join(framesDir, `frame-${String(frame).padStart(4, "0")}.png`),
    clip: { x: 0, y: 0, width, height },
    animations: "disabled"
  });
}

await browser.close();

const ffmpegArgs = [
  "-y",
  "-framerate", String(fps),
  "-i", join(framesDir, "frame-%04d.png"),
];

if (existsSync(audio)) {
  ffmpegArgs.push("-t", String(duration), "-i", audio);
}

ffmpegArgs.push(
  "-c:v", "libx264",
  "-pix_fmt", "yuv420p",
);

if (existsSync(audio)) {
  ffmpegArgs.push("-c:a", "aac", "-b:a", "192k", "-shortest");
}

ffmpegArgs.push(
  "-movflags", "+faststart",
  output
);

const ffmpeg = spawnSync("ffmpeg", ffmpegArgs, { stdio: "inherit" });

if (ffmpeg.error) {
  console.error("\nFFmpeg was not found. Install FFmpeg, then run this script again.");
  process.exit(1);
}

if (ffmpeg.status !== 0 || !existsSync(output)) {
  console.error("\nFFmpeg failed to create the MP4.");
  process.exit(ffmpeg.status || 1);
}

console.log(`\nCreated ${output}`);
