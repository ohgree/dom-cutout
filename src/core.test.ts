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
