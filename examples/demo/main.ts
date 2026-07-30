import { type CutoutShape, createCutout } from "dom-cutout";

// Capture scene for the README gif — driven by scripts/record-demo.mjs via
// window.runDemo(). Two vignettes: the classic status dot (conditional
// overlay), and a concave star traced contour-for-contour with a gap sweep
// and a contour/box comparison.

const el = (id: string) => document.getElementById(id)!;

const avatar = createCutout(el("avatar-content"), el("avatar-overlay"), { gap: 6 });

let tileInstance = createCutout(el("tile-content"), el("tile-overlay"), { gap: 6 });
const setTile = (gap: number, shape: CutoutShape) => {
  tileInstance.destroy();
  tileInstance = createCutout(el("tile-content"), el("tile-overlay"), { gap, shape });
  el("tile-caption").innerHTML = `shape=${shape}&ensp;gap: ${gap}px`;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const runDemo = async () => {
  await sleep(900);

  // 1. Conditional overlay: hiding the dot clears the mask.
  el("avatar-dot").style.display = "none";
  el("avatar-caption").textContent = "dot: hidden";
  avatar.update();
  await sleep(1000);
  el("avatar-dot").style.display = "";
  el("avatar-caption").textContent = "dot: shown";
  avatar.update();
  await sleep(1100);

  // 2. Gap sweep on the concave star — the halo hugs the glyph outline.
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
