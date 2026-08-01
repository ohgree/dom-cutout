import { createCutout } from "dom-cutout";

import { Box, createIcons, Sparkles, Spline } from "lucide";

import { highlightWithin } from "./highlight";
import { wireReveals } from "./reveal";
import { wireThemeToggle } from "./theme";

wireThemeToggle(document.getElementById("theme-toggle")!);
wireReveals();

import("./tour").then(({ mountTour }) => mountTour(document.getElementById("tour")!));

// Feature-card icons come from lucide; render them before the cutouts
// below measure the overlays.
createIcons({ icons: { Box, Spline, Sparkles } });

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
