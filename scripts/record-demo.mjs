// Records docs/assets/demo.webp (+ .gif fallback) from the capture scene
// at examples/demo/.
//
// Usage:
//   pnpm --dir examples dev          # in one terminal
//   node scripts/record-demo.mjs     # in another
//
// The scene's choreography is discrete steps, so each state is captured as
// a PNG with genuine 8-bit alpha (omitBackground) and the frames are
// assembled with per-frame durations. No video pass and no chroma keying:
// keyed transparency leaves dark fringes on edge pixels under lossy
// encoding, alpha-true PNGs don't.
//
// Requires an ffmpeg binary: uses $FFMPEG_BIN, falling back to `ffmpeg` on
// PATH, falling back to the ffmpeg-static package if installed. A gifsicle
// binary ($GIFSICLE_BIN / PATH / the gifsicle package) is used for the
// gif's lossy size pass when available.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

const BASE = process.env.DEMO_URL ?? "http://localhost:5199";
const OUT_WEBP = process.argv[2] ?? "docs/assets/demo.webp";
const OUT_GIF = OUT_WEBP.replace(/\.webp$/, ".gif");
// The scene renders at 2× real layout (?scale=2: root font-size, gap
// options), so the capture is crisp when the README displays it at half
// width. NOT CSS zoom — zoom double-applies to measured geometry and
// breaks masks recomputed mid-recording.
const SCALE = 2;

const ffmpeg = await resolveBinary("FFMPEG_BIN", "ffmpeg", "ffmpeg-static");
if (!ffmpeg) throw new Error("No ffmpeg found: install ffmpeg or `pnpm add -D ffmpeg-static`");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 600 } });
await page.goto(`${BASE}/demo/?scale=${SCALE}`, { waitUntil: "load" });
await page.waitForFunction(() => typeof window.applyStep === "function");
// omitBackground only omits the browser's default background — the page's
// own bg-slate-100 paint must be cleared too, or the margin captures opaque.
await page.evaluate(() => {
  document.body.style.background = "transparent";
});
await page.waitForTimeout(400);

const scene = await page.locator("#scene").boundingBox();
const pad = 4;
const clip = {
  x: Math.max(0, scene.x - pad),
  y: Math.max(0, scene.y - pad),
  width: scene.width + pad * 2,
  height: scene.height + pad * 2,
};

const frameDir = mkdtempSync(join(tmpdir(), "dom-cutout-frames-"));
const stepCount = await page.evaluate(() => window.demoStepCount);
const concatLines = [];
for (let i = 0; i < stepCount; i++) {
  const hold = await page.evaluate((index) => window.applyStep(index), i);
  await page.waitForTimeout(60); // paint settles
  const file = join(frameDir, `frame-${String(i).padStart(3, "0")}.png`);
  await page.screenshot({ path: file, omitBackground: true, clip });
  concatLines.push(`file '${file}'`, `duration ${hold / 1000}`);
}
// concat demuxer quirk: the last frame needs to be listed twice to hold.
concatLines.push(concatLines.at(-2));
const listFile = join(frameDir, "frames.txt");
writeFileSync(listFile, concatLines.join("\n"));
await browser.close();

const encode = (args, out) =>
  execFileSync(ffmpeg, [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listFile,
    ...args,
    out,
  ]);

// Lossless WebP: exact colors, exact 8-bit alpha, no chroma subsampling —
// flat design compresses well losslessly.
encode(
  ["-vf", "fps=10,format=rgba", "-c:v", "libwebp_anim", "-lossless", "1", "-loop", "0"],
  OUT_WEBP,
);
// GIF fallback: palette with a reserved transparent slot; alpha-true source
// pixels keep correct edge colors through the 1-bit threshold.
encode(
  [
    "-filter_complex",
    "[0:v]fps=10,split[a][b];[a]palettegen=stats_mode=diff:reserve_transparent=1[p];[b][p]paletteuse=dither=none:diff_mode=rectangle:alpha_threshold=128",
  ],
  OUT_GIF,
);

const gifsicle = await resolveBinary("GIFSICLE_BIN", "gifsicle", "gifsicle");
if (gifsicle) {
  execFileSync(gifsicle, ["-O3", "--lossy=70", OUT_GIF, "-o", OUT_GIF]);
} else {
  console.warn("gifsicle not found — skipping the gif's lossy size pass");
}
rmSync(frameDir, { recursive: true, force: true });
console.log(
  `wrote ${OUT_WEBP} + ${OUT_GIF} (${stepCount} steps, ${Math.round(clip.width)}x${Math.round(clip.height)})`,
);
