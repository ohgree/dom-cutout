import "./styles.css";

import { createCutout } from "dom-cutout";

const content = document.getElementById("hero-content")!;
const overlay = document.getElementById("hero-overlay")!;
const dot = document.getElementById("hero-dot")!;

const instance = createCutout(content, overlay, { gap: 4 });

// FOUC guard: static markup paints before this module runs; reveal the dot
// only once the first mask is applied.
overlay.style.visibility = "";

let dotShown = true;
document.getElementById("hero-toggle")!.addEventListener("click", () => {
  dotShown = !dotShown;
  dot.style.display = dotShown ? "" : "none";
  instance.update();
});
