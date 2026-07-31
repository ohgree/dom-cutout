import { afterEach, describe, expect, it } from "vitest";

import { MASKED_ATTRIBUTE, computeMaskStyle, createCutout } from "./core";

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

// The shape layer is the second mask-image layer; decode its data URI.
const shapeMarkup = (style: ReturnType<typeof computeMaskStyle>) => {
  const match = /url\("data:image\/svg\+xml,([^"]+)"\)/.exec(style?.["mask-image"] ?? "");
  return match ? decodeURIComponent(match[1]) : "";
};

// Mask application waits for the shape image decode (or its 100ms cap in
// environments that never settle image loads, like jsdom).
const settleMask = () => new Promise((resolve) => setTimeout(resolve, 250));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("computeMaskStyle", () => {
  it("returns a gradient-canvas + shape-layer composite for an svg overlay", () => {
    const { content, overlay } = setup('<svg viewBox="0 0 24 24"></svg>');

    const style = computeMaskStyle(content, overlay);

    expect(style?.["mask-image"]).toMatch(/^linear-gradient\(#000,#000\),url\("data:image\/svg/);
    expect(style?.["mask-composite"]).toBe("subtract,add");
    expect(style?.["mask-repeat"]).toBe("no-repeat,no-repeat");
  });

  // The survivor of the WebKit elimination (docs/webkit-masking.md): no
  // internal <mask> (CSS-pixel rasterization, soft edges), no mask-mode
  // (iOS luminance budget, bug 282530), no repeated tiles (seams).
  it("emits no internal <mask>, no mask-mode, no repeated tiles", () => {
    const { content, overlay } = setup('<svg viewBox="0 0 24 24"></svg>');

    const style = computeMaskStyle(content, overlay)!;

    expect(shapeMarkup(style)).not.toContain("<mask");
    expect(Object.keys(style)).not.toContain("mask-mode");
    expect(style["mask-repeat"]).not.toContain(" repeat");
  });

  it("sizes and positions the shape layer over the overlay, padded for stroke spill", () => {
    const { content, overlay } = setup('<svg viewBox="0 0 24 24"></svg>');

    const style = computeMaskStyle(content, overlay, { gap: 3 })!;

    // pad = gap + 0/2 + 1 = 4; overlay svg at 0,0 24×24 → layer at -4,-4 32×32.
    expect(style["mask-position"]).toBe("0 0,-4px -4px");
    expect(style["mask-size"]).toBe("100% 100%,32px 32px");
  });

  it("returns a rect shape layer for a non-svg overlay", () => {
    const { content, overlay } = setup("<div></div>");

    expect(shapeMarkup(computeMaskStyle(content, overlay))).toContain("<rect");
  });

  it("returns null for an empty overlay", () => {
    const { content, overlay } = setup("");

    expect(computeMaskStyle(content, overlay)).toBeNull();
  });

  it("treats whitespace and comment nodes as an empty overlay", () => {
    const { content, overlay } = setup("  <!-- badge goes here -->\n  ");

    expect(computeMaskStyle(content, overlay)).toBeNull();
  });

  it("returns null for a zero-area (hidden) overlay", () => {
    const { content, overlay } = setup('<svg viewBox="0 0 24 24"></svg>', { measured: false });
    measure(content, 100, 100);

    expect(computeMaskStyle(content, overlay)).toBeNull();
  });

  it('returns null for shape "contour" without an svg', () => {
    const { content, overlay } = setup("<div></div>");

    expect(computeMaskStyle(content, overlay, { shape: "contour" })).toBeNull();
  });

  it('uses the box branch for shape "box" even with an svg overlay', () => {
    const { content, overlay } = setup('<svg viewBox="0 0 24 24"></svg>');

    const markup = shapeMarkup(computeMaskStyle(content, overlay, { shape: "box" }));

    expect(markup).toContain("<rect");
    expect(markup).not.toContain("<g ");
  });

  it("normalizes artwork paint colors to black", () => {
    const { content, overlay } = setup(
      '<svg viewBox="0 0 24 24"><path d="M4 4h16" fill="#facc15" stroke="none" /></svg>',
    );

    const markup = shapeMarkup(computeMaskStyle(content, overlay));

    expect(markup).toContain('fill="black"');
    expect(markup).not.toContain("#facc15");
    // fill="none" / stroke="none" must survive — they mean "no paint",
    // not "paint me black".
    expect(markup).toContain('stroke="none"');
  });

  describe("stroke-width compensation", () => {
    it("adds the svg root's stroke-width to the mask stroke", () => {
      const { content, overlay } = setup(
        '<svg viewBox="0 0 24 24" stroke-width="2"><path d="M4 4h16" /></svg>',
      );

      // gap 3 → dilation 6, plus root stroke-width 2 → 8.
      expect(shapeMarkup(computeMaskStyle(content, overlay, { gap: 3 }))).toContain(
        'stroke-width="8"',
      );
    });

    it("keeps plain dilation for artwork without strokes", () => {
      const { content, overlay } = setup('<svg viewBox="0 0 24 24"><path d="M4 4h16" /></svg>');

      expect(shapeMarkup(computeMaskStyle(content, overlay, { gap: 3 }))).toContain(
        'stroke-width="6"',
      );
    });

    it("dilates per-element stroke-widths instead of letting them override the halo", () => {
      const { content, overlay } = setup(
        '<svg viewBox="0 0 24 24"><path d="M4 4h16" stroke-width="4" /></svg>',
      );

      // The element's own 4 would have replaced the halo entirely; it must
      // come out as 4 + dilation 6 = 10.
      expect(shapeMarkup(computeMaskStyle(content, overlay, { gap: 3 }))).toContain(
        'stroke-width="10"',
      );
    });
  });
});

describe("createCutout", () => {
  it("marks the content element while masked", async () => {
    const { content, overlay } = setup('<svg viewBox="0 0 24 24"></svg>');

    createCutout(content, overlay);
    await settleMask();

    expect(content.hasAttribute(MASKED_ATTRIBUTE)).toBe(true);
  });

  it("does not mark the content element for an empty overlay", async () => {
    const { content, overlay } = setup("");

    createCutout(content, overlay);
    await settleMask();

    expect(content.hasAttribute(MASKED_ATTRIBUTE)).toBe(false);
  });

  it("clears the mark when the overlay empties on update()", async () => {
    const { content, overlay } = setup('<svg viewBox="0 0 24 24"></svg>');

    const instance = createCutout(content, overlay);
    await settleMask();
    expect(content.hasAttribute(MASKED_ATTRIBUTE)).toBe(true);

    overlay.innerHTML = "";
    instance.update();

    expect(content.hasAttribute(MASKED_ATTRIBUTE)).toBe(false);
  });

  it("clears the mark when the overlay becomes zero-area on update()", async () => {
    const { content, overlay } = setup('<svg viewBox="0 0 24 24"></svg>');

    const instance = createCutout(content, overlay);
    await settleMask();
    expect(content.hasAttribute(MASKED_ATTRIBUTE)).toBe(true);

    // Simulate display:none — the element remains, its box collapses.
    measure(overlay.querySelector("svg")!, 0, 0);
    instance.update();

    expect(content.hasAttribute(MASKED_ATTRIBUTE)).toBe(false);
  });

  it("double-buffers a swap: old shape retained until the new one settles", async () => {
    const { content, overlay } = setup('<svg viewBox="0 0 24 24"></svg>');

    const instance = createCutout(content, overlay, { gap: 3 });
    await settleMask();
    // old shape layer: 32px; new after doubling the overlay: 56px
    expect(content.style.getPropertyValue("mask-size")).toContain("32px 32px");

    measure(overlay.querySelector("svg")!, 48, 48);
    instance.update();

    // Immediately: transition mask carries BOTH shapes — the old layer
    // keeps masking while Safari decodes the new image (which it paints
    // as fully transparent until then).
    const transition = content.style.getPropertyValue("mask-size");
    expect(transition).toContain("56px 56px");
    expect(transition).toContain("32px 32px");
    expect(content.style.getPropertyValue("mask-composite")).toBe("subtract,add,add");

    await settleMask();
    // Finalized: new shape alone.
    const final = content.style.getPropertyValue("mask-size");
    expect(final).toContain("56px 56px");
    expect(final).not.toContain("32px 32px");
    expect(content.style.getPropertyValue("mask-composite")).toBe("subtract,add");
  });

  it("clears the mark on destroy()", async () => {
    const { content, overlay } = setup('<svg viewBox="0 0 24 24"></svg>');

    const instance = createCutout(content, overlay);
    instance.destroy();
    await settleMask();

    // The pending decode-then-apply must not resurrect the mask.
    expect(content.hasAttribute(MASKED_ATTRIBUTE)).toBe(false);
  });
});
