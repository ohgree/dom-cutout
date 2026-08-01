import { createCutout, type CutoutInstance } from "dom-cutout";

import { wireThemeToggle } from "../theme";

wireThemeToggle(document.getElementById("theme-toggle")!);

const content = document.getElementById("content")!;
const overlay = document.getElementById("overlay")!;
const dot = document.getElementById("dot")!;

let dotShown = true;
// Options are read live on every update — mutate and call update() to
// change them; recreating would clear the mask in between.
const options = { gap: 4 };
let instance: CutoutInstance | null = createCutout(content, overlay, options);

// FOUC guard: the static markup paints before this module runs, which would
// briefly show the dot without its gap. index.html hides the overlay
// inline; reveal it only once the first mask is applied.
overlay.style.visibility = "";

const dotButton = document.getElementById("toggle-dot")!;
dotButton.addEventListener("click", () => {
  dotShown = !dotShown;
  dot.style.display = dotShown ? "" : "none";
  dotButton.textContent = `Dot: ${dotShown ? "shown" : "hidden"}`;
  // display:none is a size change, so ResizeObserver catches it — but calling
  // update() keeps the mask in sync even in environments without RO.
  instance?.update();
});

const gapButton = document.getElementById("toggle-gap")!;
gapButton.addEventListener("click", () => {
  options.gap = options.gap === 4 ? 8 : 4;
  gapButton.textContent = `Gap: ${options.gap}px`;
  instance?.update();
});

const destroyButton = document.getElementById("destroy")!;
destroyButton.addEventListener("click", () => {
  instance?.destroy();
  instance = null;
  destroyButton.textContent = "destroyed (reload to reset)";
  destroyButton.setAttribute("disabled", "");
});

// Progressive enhancement: syntax-highlight the static snippet. Imported
// dynamically so the (heavy) highlighter never delays the cutout above —
// a static import would hold the whole module graph, mask included, until
// shiki's chunks load. The plain block stays if highlighting fails.
const codeEl = document.querySelector<HTMLPreElement>("pre.code");
if (codeEl?.textContent) {
  const snippet = codeEl.textContent;
  import("shiki").then(({ codeToHtml }) =>
    codeToHtml(snippet, { lang: "ts", theme: "github-light-default" }).then((html) => {
      codeEl.outerHTML = html;
    }),
  );
}
