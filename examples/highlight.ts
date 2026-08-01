// Shared progressive syntax highlighting. Dynamic import keeps the (heavy)
// highlighter off every page's critical path — the plain blocks stay if it
// never resolves. Shiki's outerHTML replacement drops attributes on the
// <pre> itself, so visibility/spacing belong to wrapper elements.
export const highlightWithin = (root: HTMLElement, lang: "ts" | "sh") => {
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
