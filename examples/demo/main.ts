import { createCutout } from "dom-cutout";

// Capture scene for the README animation — same hero twice (fake
// background-colored outline → real cutout) while the card background
// changes underneath, then a gap sweep on the real cutout.
//
// The choreography is a list of discrete steps so scripts/record-demo.ts
// can capture one alpha-true PNG per state (no video, no chroma keying —
// keyed transparency bleeds dark fringes into edge pixels under lossy
// encoding). window.runDemo() replays the same timeline in real time for
// eyeballing in a browser.

const el = (id: string) => document.getElementById(id)!;

// ?scale=N renders the scene at N× for a high-resolution recording — via
// real layout (root font-size scales every rem-based size), NOT CSS zoom:
// zoom double-applies to anything measured with getBoundingClientRect, so
// masks recomputed after zoom land at 2× offsets. Gap options are in real
// pixels, so they scale here.
const scale = Number(new URLSearchParams(location.search).get("scale") ?? "1") || 1;
document.documentElement.style.fontSize = `${16 * scale}px`;

let instance = createCutout(el("cut-content"), el("cut-overlay"), { gap: 4 * scale });
const setGap = (gap: number) => {
  instance.destroy();
  instance = createCutout(el("cut-content"), el("cut-overlay"), { gap: gap * scale });
};

// Fixed-px backgrounds (deliberately not rem: pattern size is tuned for the
// recording). The left hero's outline is painted in the purple opener's
// color — perfect on frame one, exposed by everything after.
const BG = {
  purple: "#ddd6fe",
  white: "#ffffff",
  dark: "#1e293b",
  // Strong hue travel: subtle pastel gradients posterize into a flat wash
  // under gif palette quantization.
  gradient: "linear-gradient(295deg, #4f46e5, #db2777 55%, #f59e0b)",
  checker: "repeating-conic-gradient(#dde2e9 0% 25%, #ffffff 0% 50%) 0 0 / 24px 24px",
};

interface Step {
  bg?: keyof typeof BG;
  gap?: number;
  hold: number;
}

const TIMELINE: Step[] = [
  { bg: "purple", hold: 1400 },
  { bg: "white", hold: 1300 },
  { bg: "dark", hold: 1400 },
  { bg: "gradient", hold: 1400 },
  { bg: "checker", hold: 1300 },
  ...[3, 2, 1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 9, 8, 7, 6, 5].map((gap) => ({
    gap,
    hold: 130,
  })),
  { gap: 4, hold: 1100 },
];

/** Applies step `index` and returns how long it holds, in ms. */
const applyStep = (index: number) => {
  const step = TIMELINE[index];
  if (step.bg) el("scene").style.background = BG[step.bg];
  if (step.gap !== undefined) setGap(step.gap);
  return step.hold;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const runDemo = async () => {
  for (let index = 0; index < TIMELINE.length; index++) {
    await sleep(applyStep(index));
  }
};

declare global {
  interface Window {
    demoStepCount: number;
    applyStep: typeof applyStep;
    runDemo: typeof runDemo;
  }
}
window.demoStepCount = TIMELINE.length;
window.applyStep = applyStep;
window.runDemo = runDemo;
