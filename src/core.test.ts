import { afterEach, describe, expect, it } from "vitest";

import { MASKED_ATTRIBUTE, computeMaskUrl, createCutout } from "./core";

// jsdom measures everything as 0×0 and zero-area overlays (correctly) clear
// the mask, so setup() pins real geometry by default: content 100×100 and
// the overlay's visible element 24×24 — with a 24-unit viewBox that makes
// scale 1, so dilation = 2 × gap in both px and viewBox units.
const rect = (width: number, height: number) => ({ left: 0, top: 0, width, height }) as DOMRect;

const measure = (el: Element, width: number, height: number) => {
  Object.defineProperty(el, "getBoundingClientRect", {
    value: () => rect(width, height),
    configurable: true,
  });
};

const setup = (overlayHtml: string, { measured = true } = {}) => {
  const root = document.createElement("div");
  document.body.appendChild(root);
  root.innerHTML = `<div id="content">content</div><div id="overlay">${overlayHtml}</div>`;
  const content = root.querySelector<HTMLElement>("#content")!;
  const overlay = root.querySelector<HTMLElement>("#overlay")!;

  if (measured) {
    measure(content, 100, 100);
    const visible = overlay.querySelector("svg") ?? overlay.firstElementChild;
    if (visible) measure(visible, 24, 24);
  }
  return { root, content, overlay };
};

const decoded = (url: string | null) => decodeURIComponent(url ?? "");

afterEach(() => {
  document.body.innerHTML = "";
});

describe("computeMaskUrl", () => {
  it("returns an SVG data-uri mask for an svg overlay", () => {
    const { content, overlay } = setup('<svg viewBox="0 0 24 24"></svg>');

    const url = computeMaskUrl(content, overlay);

    expect(url).toContain("data:image/svg+xml");
    expect(decoded(url)).toContain('fill="white"');
  });

  it("returns a rect mask for a non-svg overlay", () => {
    const { content, overlay } = setup("<div></div>");

    expect(decoded(computeMaskUrl(content, overlay))).toContain("<rect");
  });

  it("returns null for an empty overlay", () => {
    const { content, overlay } = setup("");

    expect(computeMaskUrl(content, overlay)).toBeNull();
  });

  it("treats whitespace and comment nodes as an empty overlay", () => {
    const { content, overlay } = setup("  <!-- badge goes here -->\n  ");

    expect(computeMaskUrl(content, overlay)).toBeNull();
  });

  it("returns null for a zero-area (hidden) overlay", () => {
    const { content, overlay } = setup('<svg viewBox="0 0 24 24"></svg>', { measured: false });
    measure(content, 100, 100);

    expect(computeMaskUrl(content, overlay)).toBeNull();
  });

  it('returns null for shape "contour" without an svg', () => {
    const { content, overlay } = setup("<div></div>");

    expect(computeMaskUrl(content, overlay, { shape: "contour" })).toBeNull();
  });

  it('uses the box branch for shape "box" even with an svg overlay', () => {
    const { content, overlay } = setup('<svg viewBox="0 0 24 24"></svg>');

    const url = computeMaskUrl(content, overlay, { shape: "box" });

    expect(decoded(url)).toContain("<rect");
    expect(decoded(url)).not.toContain("<g ");
  });

  describe("luminance structure", () => {
    // WebKit rasterizes mask images containing internal <mask> elements at
    // CSS-pixel resolution — the generated markup must stay a simple
    // white-canvas + black-shape SVG with no <mask> indirection.
    it("emits a simple SVG without an internal <mask>", () => {
      const { content, overlay } = setup('<svg viewBox="0 0 24 24"></svg>');

      const markup = decoded(computeMaskUrl(content, overlay));

      expect(markup).not.toContain("<mask");
      expect(markup).toContain('fill="white"');
    });

    it("normalizes artwork paint colors to black (luminance reads color)", () => {
      const { content, overlay } = setup(
        '<svg viewBox="0 0 24 24"><path d="M4 4h16" fill="#facc15" stroke="none" /></svg>',
      );

      const markup = decoded(computeMaskUrl(content, overlay));

      expect(markup).toContain('fill="black"');
      expect(markup).not.toContain("#facc15");
      // fill="none" / stroke="none" must survive — they mean "no paint",
      // not "paint me black".
      expect(markup).toContain('stroke="none"');
    });
  });

  describe("stroke-width compensation", () => {
    it("adds the svg root's stroke-width to the mask stroke", () => {
      const { content, overlay } = setup(
        '<svg viewBox="0 0 24 24" stroke-width="2"><path d="M4 4h16" /></svg>',
      );

      // gap 3 → dilation 6, plus root stroke-width 2 → 8.
      expect(decoded(computeMaskUrl(content, overlay, { gap: 3 }))).toContain('stroke-width="8"');
    });

    it("keeps plain dilation for artwork without strokes", () => {
      const { content, overlay } = setup('<svg viewBox="0 0 24 24"><path d="M4 4h16" /></svg>');

      expect(decoded(computeMaskUrl(content, overlay, { gap: 3 }))).toContain('stroke-width="6"');
    });

    it("dilates per-element stroke-widths instead of letting them override the halo", () => {
      const { content, overlay } = setup(
        '<svg viewBox="0 0 24 24"><path d="M4 4h16" stroke-width="4" /></svg>',
      );

      // The element's own 4 would have replaced the halo entirely; it must
      // come out as 4 + dilation 6 = 10.
      expect(decoded(computeMaskUrl(content, overlay, { gap: 3 }))).toContain('stroke-width="10"');
    });
  });
});

describe("createCutout", () => {
  it("marks the content element while masked", () => {
    const { content, overlay } = setup('<svg viewBox="0 0 24 24"></svg>');

    createCutout(content, overlay);

    expect(content.hasAttribute(MASKED_ATTRIBUTE)).toBe(true);
  });

  it("does not mark the content element for an empty overlay", () => {
    const { content, overlay } = setup("");

    createCutout(content, overlay);

    expect(content.hasAttribute(MASKED_ATTRIBUTE)).toBe(false);
  });

  it("clears the mark when the overlay empties on update()", () => {
    const { content, overlay } = setup('<svg viewBox="0 0 24 24"></svg>');

    const instance = createCutout(content, overlay);
    expect(content.hasAttribute(MASKED_ATTRIBUTE)).toBe(true);

    overlay.innerHTML = "";
    instance.update();

    expect(content.hasAttribute(MASKED_ATTRIBUTE)).toBe(false);
  });

  it("clears the mark when the overlay becomes zero-area on update()", () => {
    const { content, overlay } = setup('<svg viewBox="0 0 24 24"></svg>');

    const instance = createCutout(content, overlay);
    expect(content.hasAttribute(MASKED_ATTRIBUTE)).toBe(true);

    // Simulate display:none — the element remains, its box collapses.
    measure(overlay.querySelector("svg")!, 0, 0);
    instance.update();

    expect(content.hasAttribute(MASKED_ATTRIBUTE)).toBe(false);
  });

  it("clears the mark on destroy()", () => {
    const { content, overlay } = setup('<svg viewBox="0 0 24 24"></svg>');

    const instance = createCutout(content, overlay);
    instance.destroy();

    expect(content.hasAttribute(MASKED_ATTRIBUTE)).toBe(false);
  });
});
