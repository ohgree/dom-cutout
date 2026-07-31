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
// Chroma-key backdrop: pure green never appears in the scene, so ffmpeg can
// key it to transparency — the rounded card floats on the README background
// instead of carrying a rectangle of page color.
await page.evaluate(() => {
  document.body.style.background = "#00ff00";
});
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
  `[0:v]crop=${w}:${h}:${x}:${y},fps=10,colorkey=0x00FF00:0.3:0.1,despill=type=green,split[a][b];[a]palettegen=stats_mode=diff:reserve_transparent=1[p];[b][p]paletteuse=dither=none:diff_mode=rectangle:alpha_threshold=128`,
  OUT,
]);

const gifsicle = await resolveGifsicle();
if (gifsicle) {
  execFileSync(gifsicle, ["-O3", "--lossy=70", OUT, "-o", OUT]);
} else {
  console.warn("gifsicle not found — skipping the lossy size pass");
}

// Animated WebP alongside the GIF: 24-bit color (no palette posterization)
// and 8-bit alpha, so the keyed card edge stays smoothly antialiased
// instead of hard-thresholded. The README embeds this one; the GIF stays
// as the anything-else fallback.
const WEBP = OUT.replace(/\.gif$/, ".webp");
execFileSync(ffmpeg, [
  "-y",
  "-loglevel",
  "error",
  "-ss",
  "0.4",
  "-i",
  video,
  "-filter_complex",
  `[0:v]crop=${w}:${h}:${x}:${y},fps=10,colorkey=0x00FF00:0.3:0.1,despill=type=green,format=yuva420p`,
  "-c:v",
  "libwebp_anim",
  "-loop",
  "0",
  "-lossless",
  "0",
  "-q:v",
  "80",
  "-compression_level",
  "6",
  WEBP,
]);
console.log(`wrote ${OUT} + ${WEBP} (crop ${w}x${h}+${x}+${y}, source ${video})`);
