import { render } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { MASKED_ATTRIBUTE } from "./core";
import { Cutout } from "./react";

afterEach(() => {
  document.body.innerHTML = "";
});

const contentEl = (container: HTMLElement) =>
  container.querySelector<HTMLElement>("[data-cutout-content]")!;

const renderCutout = (overlay: ReactNode) =>
  render(
    <Cutout overlay={overlay}>
      <div>content</div>
    </Cutout>,
  );

describe("<Cutout />", () => {
  it("masks children when an overlay is provided", () => {
    const { container } = renderCutout(<svg viewBox="0 0 10 10" />);

    expect(contentEl(container).hasAttribute(MASKED_ATTRIBUTE)).toBe(true);
  });

  it.each([null, undefined, false] as const)(
    "leaves children unmasked when overlay is %s",
    (overlay) => {
      const { container } = renderCutout(overlay);

      expect(contentEl(container).hasAttribute(MASKED_ATTRIBUTE)).toBe(false);
    },
  );

  it("clears the mask when the overlay becomes nullish", () => {
    const { container, rerender } = renderCutout(<svg viewBox="0 0 10 10" />);
    expect(contentEl(container).hasAttribute(MASKED_ATTRIBUTE)).toBe(true);

    rerender(
      <Cutout overlay={null}>
        <div>content</div>
      </Cutout>,
    );

    expect(contentEl(container).hasAttribute(MASKED_ATTRIBUTE)).toBe(false);
  });

  it("forwards ref to the wrapper element", () => {
    const ref = { current: null as HTMLDivElement | null };
    render(
      <Cutout ref={ref} overlay={null}>
        <div>content</div>
      </Cutout>,
    );

    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current?.querySelector("[data-cutout-content]")).not.toBeNull();
  });

  it("re-applies the mask when the overlay returns", () => {
    const { container, rerender } = renderCutout(null);
    expect(contentEl(container).hasAttribute(MASKED_ATTRIBUTE)).toBe(false);

    rerender(
      <Cutout overlay={<svg viewBox="0 0 10 10" />}>
        <div>content</div>
      </Cutout>,
    );

    expect(contentEl(container).hasAttribute(MASKED_ATTRIBUTE)).toBe(true);
  });
});
