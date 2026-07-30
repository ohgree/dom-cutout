import { type CutoutShape, createCutout } from "dom-cutout";

// Capture scene for the README gif — driven by scripts/record-demo.mjs via
// window.runDemo(). A concave star traced contour-for-contour: overlay
// toggling (conditional mask), a gap sweep, and a contour/box comparison.

const el = (id: string) => document.getElementById(id)!;

// ?scale=N renders the scene at N× for a high-resolution recording — via
// real layout (root font-size scales every rem-based size), NOT CSS zoom:
// zoom double-applies to anything measured with getBoundingClientRect, so
// masks recomputed after zoom land at 2× offsets. Gap options are in real
// pixels, so they scale here; the caption shows the logical values.
const scale = Number(new URLSearchParams(location.search).get("scale") ?? "1") || 1;
document.documentElement.style.fontSize = `${16 * scale}px`;
el("tile-caption").style.fontSize = `${13 * scale}px`;

let instance = createCutout(el("tile-content"), el("tile-overlay"), { gap: 6 * scale });
const caption = (text: string) => {
  el("tile-caption").innerHTML = text;
};
const setTile = (gap: number, shape: CutoutShape) => {
  instance.destroy();
  instance = createCutout(el("tile-content"), el("tile-overlay"), { gap: gap * scale, shape });
  caption(`shape=${shape}&ensp;gap: ${gap}px`);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const runDemo = async () => {
  await sleep(900);

  // 1. Conditional overlay: hiding the star clears the mask.
  el("tile-star").style.display = "none";
  caption("overlay: hidden");
  instance.update();
  await sleep(1100);
  el("tile-star").style.display = "";
  caption("shape=contour&ensp;gap: 6px");
  instance.update();
  await sleep(1200);

  // 2. Gap sweep — the halo hugs the concave glyph outline.
  for (const gap of [5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    setTile(gap, "contour");
    await sleep(130);
  }
  await sleep(700);
  setTile(6, "contour");
  await sleep(900);

  // 3. contour vs box on the same overlay.
  setTile(6, "box");
  await sleep(1200);
  setTile(6, "contour");
  await sleep(900);
};

declare global {
  interface Window {
    runDemo: typeof runDemo;
  }
}
window.runDemo = runDemo;
