import { render } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { MASKED_ATTRIBUTE } from "./core";
import { Cutout, useCutout } from "./react";

// jsdom measures everything as 0×0, and zero-area overlays (correctly)
// clear the mask — give every element a real box so overlays count.
const realGetBoundingClientRect = Element.prototype.getBoundingClientRect;

beforeAll(() => {
  Element.prototype.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 24, height: 24 }) as DOMRect;
});

afterAll(() => {
  Element.prototype.getBoundingClientRect = realGetBoundingClientRect;
});

afterEach(() => {
  document.body.innerHTML = "";
});

const childEl = (container: HTMLElement) => container.querySelector<HTMLElement>("#child")!;

// Mask application waits for the shape image decode (or its 100ms cap in
// environments that never settle image loads, like jsdom).
const settleMask = () => new Promise((resolve) => setTimeout(resolve, 150));

const renderCutout = (overlay: ReactNode) =>
  render(
    <Cutout overlay={overlay}>
      <div id="child">content</div>
    </Cutout>,
  );

describe("<Cutout />", () => {
  it("masks the child element itself when an overlay is provided", async () => {
    const { container } = renderCutout(<svg viewBox="0 0 10 10" />);
    await settleMask();

    expect(childEl(container).hasAttribute(MASKED_ATTRIBUTE)).toBe(true);
  });

  it("inserts no wrapper around the child", () => {
    const { container } = renderCutout(<svg viewBox="0 0 10 10" />);

    // The child is a direct child of the render container; its only lib
    // sibling is the absolutely positioned (out-of-flow) overlay layer.
    const child = childEl(container);
    expect(child.parentElement).toBe(container);
    const layer = child.nextElementSibling as HTMLElement;
    expect(layer.hasAttribute("data-cutout-overlay")).toBe(true);
    expect(layer.style.position).toBe("absolute");
  });

  it.each([null, undefined, false] as const)(
    "leaves the child unmasked when overlay is %s",
    (overlay) => {
      const { container } = renderCutout(overlay);

      expect(childEl(container).hasAttribute(MASKED_ATTRIBUTE)).toBe(false);
    },
  );

  it("clears the mask when the overlay becomes nullish", async () => {
    const { container, rerender } = renderCutout(<svg viewBox="0 0 10 10" />);
    await settleMask();
    expect(childEl(container).hasAttribute(MASKED_ATTRIBUTE)).toBe(true);

    rerender(
      <Cutout overlay={null}>
        <div id="child">content</div>
      </Cutout>,
    );

    expect(childEl(container).hasAttribute(MASKED_ATTRIBUTE)).toBe(false);
  });

  it("re-applies the mask when the overlay returns", async () => {
    const { container, rerender } = renderCutout(null);
    expect(childEl(container).hasAttribute(MASKED_ATTRIBUTE)).toBe(false);

    rerender(
      <Cutout overlay={<svg viewBox="0 0 10 10" />}>
        <div id="child">content</div>
      </Cutout>,
    );
    await settleMask();

    expect(childEl(container).hasAttribute(MASKED_ATTRIBUTE)).toBe(true);
  });

  it("keeps the child clickable: the overlay layer has pointer-events none", () => {
    const { container } = renderCutout(<svg viewBox="0 0 10 10" />);

    const overlayLayer = container.querySelector<HTMLElement>("[data-cutout-overlay]")!;
    expect(overlayLayer.style.pointerEvents).toBe("none");
  });

  it("wires the anchor rules declaratively: style element + data attributes", () => {
    const { container } = renderCutout(<svg viewBox="0 0 10 10" />);

    const child = childEl(container);
    const layer = container.querySelector<HTMLElement>("[data-cutout-layer]")!;
    const id = child.getAttribute("data-cutout-anchor");
    expect(id).toBeTruthy();
    expect(layer.getAttribute("data-cutout-layer")).toBe(id);

    const css = container.querySelector("style")!.textContent!;
    expect(css).toContain(`[data-cutout-anchor="${id}"]{anchor-name:--dom-cutout-${id}}`);
    // inset: 0 base first, anchor() upgrades after — CSS error handling picks.
    expect(css).toContain("inset:0;top:anchor(");
    expect(css).toContain(`width:anchor-size(--dom-cutout-${id} width)`);
  });

  it("composes with the child's own ref", () => {
    const ref = { current: null as HTMLDivElement | null };
    render(
      <Cutout overlay={null}>
        <div id="child" ref={ref}>
          content
        </div>
      </Cutout>,
    );

    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current?.id).toBe("child");
  });

  it("rejects multiple children", () => {
    // React.Children.only is the enforcement; silence its console noise.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        // @ts-expect-error — two children violate the single-element contract
        <Cutout overlay={null}>
          <div>one</div>
          <div>two</div>
        </Cutout>,
      ),
    ).toThrow();
    spy.mockRestore();
  });
});

const Harness = ({ overlay }: { overlay: boolean }) => {
  const { contentRef, overlayRef } = useCutout<HTMLDivElement, HTMLDivElement>();
  return (
    <>
      <div id="child" ref={contentRef}>
        content
      </div>
      <div ref={overlayRef}>{overlay ? <svg viewBox="0 0 10 10" /> : null}</div>
    </>
  );
};

describe("useCutout", () => {
  it("masks the content element without inserting any DOM", async () => {
    const { container } = render(<Harness overlay />);
    await settleMask();

    expect(childEl(container).hasAttribute(MASKED_ATTRIBUTE)).toBe(true);
  });

  it("clears the mask when the overlay empties", async () => {
    const { container, rerender } = render(<Harness overlay />);
    await settleMask();
    expect(childEl(container).hasAttribute(MASKED_ATTRIBUTE)).toBe(true);

    rerender(<Harness overlay={false} />);

    expect(childEl(container).hasAttribute(MASKED_ATTRIBUTE)).toBe(false);
  });
});
