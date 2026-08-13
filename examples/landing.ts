import { createCutout } from "dom-cutout";

import { Box, createIcons, LineSquiggle, Sparkles } from "lucide";

import { highlightWithin } from "./highlight";
import { wireReveals } from "./reveal";
import { wireThemeToggle } from "./theme";

wireThemeToggle(document.getElementById("theme-toggle")!);
wireReveals();

import("./tour").then(({ mountTour }) => mountTour(document.getElementById("tour")!));

// Feature-card icons come from lucide; render them before the cutouts
// below measure the overlays.
createIcons({ icons: { Box, LineSquiggle, Sparkles } });

// The hero wordmark is a cutout through text glyphs, which mask-image
// handles like any other painted output. The gap scales with the
// responsive type size - 3px at the 48px mobile wordmark, 5px at the 96px
// desktop one; options are read live, so resize just rewrites gap.
const titleOverlay = document.getElementById("title-overlay")!;
const wordmark = document.getElementById("title-content")!;
const titleOptions = { gap: 3 };
const title = createCutout(wordmark, titleOverlay, titleOptions);
let titleFontSize = 48;
const syncTitleGap = () => {
  titleFontSize = parseFloat(getComputedStyle(wordmark).fontSize) || 48;
  titleOptions.gap = Math.round(3 + ((titleFontSize - 48) * 2) / 48);
  title.update();
};
syncTitleGap();
addEventListener("resize", syncTitleGap, { passive: true });

// Feature cards: the corner icon is carved out of the card surface itself.
const featureOverlays = ["core", "contour", "crisp"].map((name) => {
  const featureOverlay = document.getElementById(`feat-${name}-overlay`)!;
  createCutout(document.getElementById(`feat-${name}`)!, featureOverlay, { gap: 3 });
  return featureOverlay;
});

// FOUC guard: static markup paints before this module runs; reveal overlays
// only once their first masks are applied.
titleOverlay.style.visibility = "";
for (const featureOverlay of featureOverlays) featureOverlay.style.visibility = "";

// Scroll-scrubbed hero: the scissors slide in along their own blade line
// (the 30deg tangent) from the top-left, fading into existence, and rest
// mid-cut between "dom" and "cutout". Translation-only, so every frame
// keeps the mask image byte-identical (the fast path), and there is no
// update() call: the style writes are exactly what the default follow
// detectors pick up. The hole doesn't fade - a mask is a silhouette, not
// a paint - so the cut channel arrives ahead of the materializing blades.
const hero = document.getElementById("hero")!;
const scissors = document.getElementById("title-scissors")!;
const scrollHint = document.getElementById("scroll-hint")!;
const TRAVEL_EM = 1.4;
const TANGENT = (30 * Math.PI) / 180;
const scrubHero = () => {
  const runway = hero.getBoundingClientRect();
  const scrollable = runway.height - window.innerHeight;
  const local = Math.min(1, Math.max(0, -runway.top / scrollable));
  // The slide plays over the runway's 15%-50% stretch, then the scissors
  // hold their final position for the whole second half.
  const t = Math.min(1, Math.max(0, (local - 0.15) / 0.35));
  const back = (1 - t) * TRAVEL_EM * titleFontSize;
  const dpr = window.devicePixelRatio || 1;
  const snap = (value: number) => Math.round(value * dpr) / dpr;
  const restX = 0.31 * wordmark.offsetWidth;
  const restY = 0.067 * titleFontSize - 4;
  scissors.style.left = `${snap(restX - back * Math.cos(TANGENT))}px`;
  scissors.style.top = `${snap(restY - back * Math.sin(TANGENT))}px`;
  const fade = Math.min(1, t * 1.6);
  scissors.style.opacity = String(fade);
  // opacity: 0 alone can ghost on iOS - the compositor may keep the layer's
  // last raster instead of repainting at zero alpha after a flick settles.
  // visibility drops the element from painting outright.
  scissors.style.visibility = fade === 0 ? "hidden" : "";
  // The hint stays up while the stage is pinned (the page LOOKS stationary
  // even though the visitor is scrolling - keep encouraging them), and
  // fades right before the runway ends and the hero actually moves away.
  scrollHint.style.opacity = String(1 - Math.min(1, Math.max(0, (local - 0.85) / 0.1)));
};
// iOS momentum scrolling delivers events sparsely and can settle without a
// final one, leaving the scrub a step stale (a faintly visible scissors
// after a hard flick to the top). After each event, a rAF chain re-runs
// the scrub every frame until the scroll position holds still - which also
// smooths the scrub between iOS's sparse events.
let settleFrame = 0;
let settledY = -1;
let stillFrames = 0;
const settleLoop = () => {
  scrubHero();
  stillFrames = window.scrollY === settledY ? stillFrames + 1 : 0;
  settledY = window.scrollY;
  settleFrame = stillFrames < 2 ? requestAnimationFrame(settleLoop) : 0;
};
const onHeroScroll = () => {
  scrubHero();
  cancelAnimationFrame(settleFrame);
  stillFrames = 0;
  settleFrame = requestAnimationFrame(settleLoop);
};
addEventListener("scroll", onHeroScroll, { passive: true });
addEventListener("resize", scrubHero, { passive: true });
scrubHero();

highlightWithin(document.getElementById("install-blocks")!, "sh");

// Click-to-copy on the install commands. The button lives on the block
// wrapper, not inside the <pre> - shiki replaces that element wholesale.
const COPY_ICON =
  '<svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const CHECK_ICON =
  '<svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
for (const block of document.querySelectorAll<HTMLElement>("#install-blocks > div")) {
  block.classList.add("relative");
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "copy-btn";
  copy.setAttribute("aria-label", "Copy command");
  copy.innerHTML = COPY_ICON;
  let restore = 0;
  copy.addEventListener("click", async () => {
    const command = block.querySelector("code")?.textContent?.trim();
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      return; // clipboard unavailable (insecure context): stay inert
    }
    copy.innerHTML = CHECK_ICON;
    copy.classList.add("copied");
    clearTimeout(restore);
    restore = window.setTimeout(() => {
      copy.innerHTML = COPY_ICON;
      copy.classList.remove("copied");
    }, 1500);
  });
  block.append(copy);
}

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
