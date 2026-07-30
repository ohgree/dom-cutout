import { afterEach, describe, expect, it } from "vitest";

import { MASKED_ATTRIBUTE, computeMaskUrl, createCutout } from "./core";

// jsdom's CSSOM drops mask-image, so DOM-application tests assert on the
// MASKED_ATTRIBUTE hook; mask content itself is covered via computeMaskUrl.
const setup = (overlayHtml: string) => {
  const root = document.createElement("div");
  document.body.appendChild(root);
  root.innerHTML = `<div id="content">content</div><div id="overlay">${overlayHtml}</div>`;
  const content = root.querySelector<HTMLElement>("#content")!;
  const overlay = root.querySelector<HTMLElement>("#overlay")!;
  return { root, content, overlay };
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("computeMaskUrl", () => {
  it("returns an SVG data-uri mask for an svg overlay", () => {
    const { content, overlay } = setup('<svg viewBox="0 0 10 10"></svg>');

    const url = computeMaskUrl(content, overlay);

    expect(url).toContain("data:image/svg+xml");
    expect(url).toContain(encodeURIComponent("<mask"));
  });

  it("returns a rect mask for a non-svg overlay", () => {
    const { content, overlay } = setup('<div style="width:10px"></div>');

    const url = computeMaskUrl(content, overlay);

    expect(url).toContain(encodeURIComponent("<rect"));
  });

  it("returns null for an empty overlay", () => {
    const { content, overlay } = setup("");

    expect(computeMaskUrl(content, overlay)).toBeNull();
  });

  it('returns null for shape "contour" without an svg', () => {
    const { content, overlay } = setup("<div></div>");

    expect(computeMaskUrl(content, overlay, { shape: "contour" })).toBeNull();
  });

  describe("stroke-width compensation", () => {
    // jsdom rects are all zeros, so pin the geometry: 24-unit viewBox
    // rendered at 24px → scale 1, making dilation = 2 × gap in both units.
    const setupMeasured = (svgHtml: string) => {
      const { content, overlay } = setup(svgHtml);
      const svg = overlay.querySelector("svg")!;
      const rect = (width: number, height: number) =>
        ({ left: 0, top: 0, width, height }) as DOMRect;
      content.getBoundingClientRect = () => rect(100, 100);
      Object.defineProperty(svg, "getBoundingClientRect", { value: () => rect(24, 24) });
      return { content, overlay };
    };

    const decoded = (url: string | null) => decodeURIComponent(url ?? "");

    it("adds the svg root's stroke-width to the mask stroke", () => {
      const { content, overlay } = setupMeasured(
        '<svg viewBox="0 0 24 24" stroke-width="2"><path d="M4 4h16" /></svg>',
      );

      // gap 3 → dilation 6, plus root stroke-width 2 → 8.
      expect(decoded(computeMaskUrl(content, overlay, { gap: 3 }))).toContain('stroke-width="8"');
    });

    it("keeps plain dilation for artwork without strokes", () => {
      const { content, overlay } = setupMeasured(
        '<svg viewBox="0 0 24 24"><path d="M4 4h16" /></svg>',
      );

      expect(decoded(computeMaskUrl(content, overlay, { gap: 3 }))).toContain('stroke-width="6"');
    });

    it("dilates per-element stroke-widths instead of letting them override the halo", () => {
      const { content, overlay } = setupMeasured(
        '<svg viewBox="0 0 24 24"><path d="M4 4h16" stroke-width="4" /></svg>',
      );

      // The element's own 4 would have replaced the halo entirely; it must
      // come out as 4 + dilation 6 = 10.
      expect(decoded(computeMaskUrl(content, overlay, { gap: 3 }))).toContain('stroke-width="10"');
    });
  });

  it('uses the box branch for shape "box" even with an svg overlay', () => {
    const { content, overlay } = setup('<svg viewBox="0 0 10 10"></svg>');

    const url = computeMaskUrl(content, overlay, { shape: "box" });

    expect(url).toContain(encodeURIComponent("<rect"));
    expect(url).not.toContain(encodeURIComponent("<g "));
  });
});

describe("createCutout", () => {
  it("marks the content element while masked", () => {
    const { content, overlay } = setup('<svg viewBox="0 0 10 10"></svg>');

    createCutout(content, overlay);

    expect(content.hasAttribute(MASKED_ATTRIBUTE)).toBe(true);
  });

  it("does not mark the content element for an empty overlay", () => {
    const { content, overlay } = setup("");

    createCutout(content, overlay);

    expect(content.hasAttribute(MASKED_ATTRIBUTE)).toBe(false);
  });

  it("clears the mark when the overlay empties on update()", () => {
    const { content, overlay } = setup('<svg viewBox="0 0 10 10"></svg>');

    const instance = createCutout(content, overlay);
    expect(content.hasAttribute(MASKED_ATTRIBUTE)).toBe(true);

    overlay.innerHTML = "";
    instance.update();

    expect(content.hasAttribute(MASKED_ATTRIBUTE)).toBe(false);
  });

  it("clears the mark on destroy()", () => {
    const { content, overlay } = setup('<svg viewBox="0 0 10 10"></svg>');

    const instance = createCutout(content, overlay);
    instance.destroy();

    expect(content.hasAttribute(MASKED_ATTRIBUTE)).toBe(false);
  });
});
