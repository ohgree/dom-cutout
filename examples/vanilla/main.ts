import { createCutout } from "dom-cutout";

import { highlightWithin } from "../highlight";
import { wireReveals } from "../reveal";
import { wireThemeToggle } from "../theme";

wireThemeToggle(document.getElementById("theme-toggle")!);
wireReveals();

const byId = (id: string) => document.getElementById(id)!;

// Section 1 — attach, and clear via an empty overlay.
const overlay = byId("overlay");
const dot = byId("dot");
const instance = createCutout(byId("content"), overlay, { gap: 4 });
let dotShown = true;
const dotButton = byId("toggle-dot");
dotButton.addEventListener("click", () => {
  dotShown = !dotShown;
  dot.style.display = dotShown ? "" : "none";
  dotButton.textContent = `Dot: ${dotShown ? "shown" : "hidden"}`;
  // display:none is a size change, so ResizeObserver catches it — but
  // update() keeps the mask in sync even in environments without RO.
  instance.update();
});

// Section 2 — options are read live: mutate and update(), don't recreate.
const overlay2 = byId("overlay-2");
const options = { gap: 4 };
const instance2 = createCutout(byId("content-2"), overlay2, options);
const gapButton = byId("toggle-gap");
gapButton.addEventListener("click", () => {
  options.gap = options.gap === 4 ? 8 : 4;
  gapButton.textContent = `Gap: ${options.gap}px`;
  instance2.update();
});

// Section 3 — teardown.
const overlay3 = byId("overlay-3");
const instance3 = createCutout(byId("content-3"), overlay3, { gap: 4 });
const destroyButton = byId("destroy");
destroyButton.addEventListener("click", () => {
  instance3.destroy();
  destroyButton.textContent = "destroyed (reload to reset)";
  destroyButton.setAttribute("disabled", "");
});

// FOUC guard: reveal overlays only once their first masks are applied.
for (const el of [overlay, overlay2, overlay3]) el.style.visibility = "";

for (const id of ["import-snippet", "attach-snippet", "options-snippet", "destroy-snippet"]) {
  highlightWithin(byId(id), "ts");
}
