import { createCutout } from "dom-cutout";

import { wireThemeToggle } from "./theme";

wireThemeToggle(document.getElementById("theme-toggle")!);

const content = document.getElementById("hero-content")!;
const overlay = document.getElementById("hero-overlay")!;
const star = document.getElementById("hero-star")!;

const instance = createCutout(content, overlay, { gap: 4 });

// The page title is a cutout too — through text glyphs, which mask-image
// handles like any other painted output.
const titleOverlay = document.getElementById("title-overlay")!;
createCutout(document.getElementById("title-content")!, titleOverlay, {
  gap: 2,
});

// Logo demo card: the wordmark at display size, gap on a slider. Options
// are read live — mutate and update(), no recreate.
const logoOverlay = document.getElementById("logo-overlay")!;
const logoOptions = { gap: 4 };
const logoInstance = createCutout(
  document.getElementById("logo-content")!,
  logoOverlay,
  logoOptions,
);
const logoGapValue = document.getElementById("logo-gap-value")!;
document.getElementById("logo-gap")!.addEventListener("input", (event) => {
  logoOptions.gap = Number((event.target as HTMLInputElement).value);
  logoGapValue.textContent = String(logoOptions.gap);
  logoInstance.update();
});

// Feature cards: the corner icon is carved out of the card surface itself.
const featureOverlays = ["core", "contour", "crisp"].map((name) => {
  const featureOverlay = document.getElementById(`feat-${name}-overlay`)!;
  createCutout(document.getElementById(`feat-${name}`)!, featureOverlay, { gap: 3 });
  return featureOverlay;
});

// FOUC guard: static markup paints before this module runs; reveal overlays
// only once their first masks are applied.
overlay.style.visibility = "";
titleOverlay.style.visibility = "";
logoOverlay.style.visibility = "";
for (const featureOverlay of featureOverlays) featureOverlay.style.visibility = "";

let starShown = true;
document.getElementById("hero-toggle")!.addEventListener("click", () => {
  starShown = !starShown;
  star.style.display = starShown ? "" : "none";
  instance.update();
});

// Cycle the hero card's background — the cutout gap shows every one of
// them through, which no background-colored border could. `""` restores
// the .demo-card checkerboard.
const heroCard = document.getElementById("hero-card")!;
const backgrounds = [
  "",
  "#ddd6fe",
  "#1e293b",
  "linear-gradient(295deg, #4f46e5, #db2777 55%, #f59e0b)",
  "#ffffff",
];
let backgroundIndex = 0;
document.getElementById("hero-bg")!.addEventListener("click", () => {
  backgroundIndex = (backgroundIndex + 1) % backgrounds.length;
  heroCard.style.background = backgrounds[backgroundIndex];
});

// Progressive enhancement: syntax-highlight the static snippets. Dynamic
// import keeps the highlighter off the demo's critical path; plain blocks
// stay if it fails. Shiki's replacement drops attributes on the <pre>
// itself, so visibility/spacing live on the wrapper elements.
const highlightWithin = (root: HTMLElement, lang: "ts" | "sh") => {
  for (const pre of root.querySelectorAll("pre")) {
    const source = pre.textContent;
    if (!source) continue;
    import("shiki").then(({ codeToHtml }) =>
      codeToHtml(source, {
        lang,
        themes: { light: "github-light-default", dark: "github-dark-default" },
        defaultColor: "light",
      }).then((html) => {
        pre.outerHTML = html;
      }),
    );
  }
};
highlightWithin(document.getElementById("hero-snippet")!, "ts");
highlightWithin(document.getElementById("install-blocks")!, "sh");

// Package-manager tabs for the install command.
const pmTabs = document.querySelectorAll<HTMLButtonElement>("#pm-tabs button");
const pmBlocks = document.querySelectorAll<HTMLElement>("#install-blocks > div");
for (const tab of pmTabs) {
  tab.addEventListener("click", () => {
    for (const t of pmTabs) t.classList.toggle("tab-active", t === tab);
    for (const block of pmBlocks) {
      block.classList.toggle("hidden", block.dataset.pm !== tab.dataset.pm);
    }
  });
}
