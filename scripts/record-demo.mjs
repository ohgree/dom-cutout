// Records docs/assets/demo.gif from the capture scene at examples/demo/.
//
// Usage:
//   pnpm --dir examples dev          # in one terminal
//   node scripts/record-demo.mjs     # in another
//
// Requires an ffmpeg binary: uses $FFMPEG_BIN, falling back to `ffmpeg` on
// PATH, falling back to the ffmpeg-static package if installed. A gifsicle
// binary ($GIFSICLE_BIN / PATH / the gifsicle package) is used for the
// lossy size pass when available — it roughly halves the file.
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const resolveBinary = async (envVar, name, pkg) => {
  if (process.env[envVar]) return process.env[envVar];
  try {
    execFileSync(name, ["--version"], { stdio: "ignore" });
    return name;
  } catch {
    try {
      const mod = await import(pkg);
      return mod.default;
    } catch {
      return null;
    }
  }
};

const resolveFfmpeg = () => resolveBinary("FFMPEG_BIN", "ffmpeg", "ffmpeg-static");
const resolveGifsicle = () => resolveBinary("GIFSICLE_BIN", "gifsicle", "gifsicle");

const BASE = process.env.DEMO_URL ?? "http://localhost:5199";
const OUT = process.argv[2] ?? "docs/assets/demo.gif";
const SIZE = { width: 1100, height: 600 };
// The scene renders at 2× real layout (?scale=2: root font-size, gap
// options), so the recording is crisp when the README displays it at half
// width. NOT CSS zoom — zoom double-applies to measured geometry and
// breaks masks recomputed mid-recording.
const SCALE = 2;

const ffmpeg = await resolveFfmpeg();
if (!ffmpeg) throw new Error("No ffmpeg found: install ffmpeg or `pnpm add -D ffmpeg-static`");
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: ".", size: SIZE } });
const page = await context.newPage();
await page.goto(`${BASE}/demo/?scale=${SCALE}`, { waitUntil: "load" });
await page.waitForFunction(() => typeof window.runDemo === "function");
await page.waitForTimeout(700); // first mask paint settles on tape
const scene = await page.locator("#scene").boundingBox();
await page.evaluate(() => window.runDemo());

await context.close(); // flushes the video
const video = await page.video().path();
await browser.close();

const pad = 4;
const x = Math.max(0, Math.round(scene.x - pad));
const y = Math.max(0, Math.round(scene.y - pad));
const w = Math.min(SIZE.width - x, Math.round(scene.width + pad * 2));
const h = Math.min(SIZE.height - y, Math.round(scene.height + pad * 2));

execFileSync(ffmpeg, [
  "-y",
  "-loglevel",
  "error",
  "-ss",
  "0.4", // page-settle dead time
  "-i",
  video,
  "-filter_complex",
  `[0:v]crop=${w}:${h}:${x}:${y},fps=10,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle`,
  OUT,
]);

const gifsicle = await resolveGifsicle();
if (gifsicle) {
  execFileSync(gifsicle, ["-O3", "--lossy=70", OUT, "-o", OUT]);
} else {
  console.warn("gifsicle not found — skipping the lossy size pass");
}
console.log(`wrote ${OUT} (crop ${w}x${h}+${x}+${y}, source ${video})`);
