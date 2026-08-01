import { createCutout, type CutoutOptions } from "dom-cutout";

import { Box, createIcons, Sparkles, Spline } from "lucide";

import { wireReveals } from "./reveal";
import { wireThemeToggle } from "./theme";

wireThemeToggle(document.getElementById("theme-toggle")!);
wireReveals();

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

// Scrollytelling stage: one avatar, one overlay layer. Each scroll step
// swaps the overlay's visible child and the live options, then update() —
// the exact mutate-and-update pattern the API documents. Scrolling fast
// through all five scenes is a stress test of the mask-swap coalescing.
const SCENES: Array<{
  caption: string;
  code: string;
  show: "dot" | "star" | "pill" | null;
  options: CutoutOptions;
}> = [
  {
    caption: "One call. The overlay's silhouette is cut out of the content behind it.",
    code: "createCutout(avatar, badge)",
    show: "dot",
    options: { gap: 4, shape: "auto" },
  },
  {
    caption: "gap sets the halo width, in rendered pixels.",
    code: "createCutout(avatar, badge, { gap: 8 })",
    show: "dot",
    options: { gap: 8, shape: "auto" },
  },
  {
    caption: "SVG overlays are traced contour-for-contour — concave outlines included.",
    code: '{ shape: "contour" } // auto, when the overlay is svg',
    show: "star",
    options: { gap: 4, shape: "contour" },
  },
  {
    caption: "The box shape follows the overlay's computed border-radius — pills stay pills.",
    code: '{ shape: "box" } // bounding box + border-radius',
    show: "pill",
    options: { gap: 4, shape: "box" },
  },
  {
    caption: "An overlay that renders nothing clears the mask — conditional badges just work.",
    code: "badge.remove(); instance.update()",
    show: null,
    options: { gap: 4, shape: "auto" },
  },
];

const storyOverlay = document.getElementById("story-overlay")!;
const storyOptions: CutoutOptions = { gap: 4, shape: "auto" };
const storyInstance = createCutout(
  document.getElementById("story-content")!,
  storyOverlay,
  storyOptions,
);
// One piece in the overlay at a time — shape: "auto" probes the overlay
// for ANY svg and the box shape measures its first element child, so
// display-toggling three siblings would confuse both. replaceChildren
// mirrors what a framework's conditional render does.
const storyPieces = {
  dot: document.getElementById("story-dot")!,
  star: document.getElementById("story-star")!,
  pill: document.getElementById("story-pill")!,
};
storyPieces.star.remove();
storyPieces.pill.remove();
const storyCaption = document.getElementById("story-caption")!;
const storySnippet = document.getElementById("story-snippet")!;
const storyDots = document.getElementById("story-dots")!;
const dots = SCENES.map(() => {
  const dot = document.createElement("span");
  dot.className = "h-1.5 w-1.5 rounded-full bg-base-content/20";
  storyDots.append(dot);
  return dot;
});

// Snippets pre-highlight once shiki lands; plain text until then.
const highlighted: (string | null)[] = SCENES.map(() => null);
let activeScene = -1;
const renderSnippet = () => {
  const html = highlighted[activeScene];
  if (html) storySnippet.innerHTML = html;
  else storySnippet.innerHTML = "";
  if (!html) {
    const pre = document.createElement("pre");
    pre.className = "shiki";
    const code = document.createElement("code");
    code.textContent = SCENES[activeScene].code;
    pre.append(code);
    storySnippet.append(pre);
  }
};
import("shiki").then(({ codeToHtml }) =>
  SCENES.forEach((scene, i) =>
    codeToHtml(scene.code, {
      lang: "ts",
      themes: { light: "github-light-default", dark: "github-dark-default" },
      defaultColor: "light",
    }).then((html) => {
      highlighted[i] = html;
      if (i === activeScene) renderSnippet();
    }),
  ),
);

const setScene = (index: number) => {
  if (index === activeScene) return;
  activeScene = index;
  const scene = SCENES[index];
  if (scene.show) storyOverlay.replaceChildren(storyPieces[scene.show]);
  else storyOverlay.replaceChildren();
  Object.assign(storyOptions, scene.options);
  storyInstance.update();
  storyCaption.textContent = scene.caption;
  renderSnippet();
  dots.forEach((dot, i) => {
    dot.className = `h-1.5 w-1.5 rounded-full ${i === index ? "bg-primary" : "bg-base-content/20"}`;
  });
};
setScene(0);

const stepObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        setScene(Number((entry.target as HTMLElement).dataset.storyStep));
      }
    }
  },
  // A band around the viewport's middle: a step owns the scene while it
  // crosses the center.
  { rootMargin: "-45% 0px -45% 0px" },
);
for (const step of document.querySelectorAll("[data-story-step]")) {
  stepObserver.observe(step);
}

// FOUC guard: static markup paints before this module runs; reveal overlays
// only once their first masks are applied.
overlay.style.visibility = "";
titleOverlay.style.visibility = "";
logoOverlay.style.visibility = "";
for (const featureOverlay of featureOverlays) featureOverlay.style.visibility = "";
document.getElementById("story-overlay")!.style.visibility = "";

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
