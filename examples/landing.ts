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

// Progressive enhancement: syntax-highlight the static snippets. Dynamic
// import keeps the highlighter off the demo's critical path; plain blocks
// stay if it fails. Shiki's replacement drops attributes on the <pre>
// itself, so visibility/spacing live on the wrapper elements.
const highlightWithin = (root: HTMLElement, lang: "ts" | "sh") => {
  for (const pre of root.querySelectorAll("pre")) {
    const source = pre.textContent;
    if (!source) continue;
    import("shiki").then(({ codeToHtml }) =>
      codeToHtml(source, { lang, theme: "github-light-default" }).then((html) => {
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
