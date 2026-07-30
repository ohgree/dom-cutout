import { createCutout } from "dom-cutout";

// Capture scene for the README gif — driven by scripts/record-demo.mjs via
// window.runDemo(). Same hero twice (fake white outline → real cutout);
// the background swaps from the one the workaround was built for to the
// ones that expose it, then the gap sweeps on the real cutout.

const el = (id: string) => document.getElementById(id)!;

// ?scale=N renders the scene at N× for a high-resolution recording — via
// real layout (root font-size scales every rem-based size), NOT CSS zoom:
// zoom double-applies to anything measured with getBoundingClientRect, so
// masks recomputed after zoom land at 2× offsets. Gap options are in real
// pixels, so they scale here.
const scale = Number(new URLSearchParams(location.search).get("scale") ?? "1") || 1;
document.documentElement.style.fontSize = `${16 * scale}px`;

let instance = createCutout(el("cut-content"), el("cut-overlay"), { gap: 6 * scale });
const setGap = (gap: number) => {
  instance.destroy();
  instance = createCutout(el("cut-content"), el("cut-overlay"), { gap: gap * scale });
};

// Fixed-px backgrounds (deliberately not rem: pattern size is tuned for the
// recording). The white outline on the left hero never changes — it was
// "built" for the white background, which is the point.
const BG = {
  white: "#ffffff",
  gradient: "linear-gradient(135deg, #a5b4fc, #f9a8d4)",
  checker: "repeating-conic-gradient(#dde2e9 0% 25%, #ffffff 0% 50%) 0 0 / 24px 24px",
};
const setBg = (bg: keyof typeof BG) => {
  el("scene").style.background = BG[bg];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const runDemo = async () => {
  // 1. The background the workaround was built for: both heroes look right.
  setBg("white");
  await sleep(1400);

  // 2. Any other background exposes the painted outline.
  setBg("gradient");
  await sleep(1600);
  setBg("checker");
  await sleep(1400);

  // 3. Gap sweep on the real cutout — live geometry, the outline can't
  // follow. Ends back at the resting 6 so the loop has no snap.
  for (const gap of [5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 9, 8, 7, 6]) {
    setGap(gap);
    await sleep(130);
  }
  await sleep(1100);
};

declare global {
  interface Window {
    runDemo: typeof runDemo;
  }
}
window.runDemo = runDemo;
