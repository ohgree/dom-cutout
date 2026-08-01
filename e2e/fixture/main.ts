import { MASKED_ATTRIBUTE, computeMaskStyle, createCutout } from "dom-cutout";

// Specs build their scenarios through this hook so each test owns its exact
// geometry. Returns nothing; specs assert via screenshots and the DOM.
declare global {
  interface Window {
    mount: typeof mount;
    MASKED_ATTRIBUTE: string;
    computeMaskStyle: typeof computeMaskStyle;
  }
}

interface MountOptions {
  /** Content square size in css px. */
  size: number;
  /** Overlay dot: square box of `dot` css px centered in the content. */
  dot: number;
  /** Optional scale on a wrapper ancestor (fractional-zoom simulation). */
  wrapperScale?: number;
  gap?: number;
  /** Border-radius on the content square, css px. */
  radius?: number;
  /** Mount without applying the mask (double-AA differential baseline). */
  masked?: boolean;
}

const mount = ({ size, dot, wrapperScale, gap, radius, masked = true }: MountOptions) => {
  document.body.textContent = "";
  const wrap = document.createElement("div");
  if (wrapperScale) {
    wrap.style.transform = `scale(${wrapperScale})`;
    wrap.style.transformOrigin = "0 0";
  }
  const stack = document.createElement("div");
  stack.style.cssText = "display:inline-grid";
  const content = document.createElement("div");
  content.id = "content";
  content.style.cssText = `grid-area:1/1;width:${size}px;height:${size}px;background:#f00;border-radius:${radius ?? 0}px`;
  const overlay = document.createElement("div");
  overlay.id = "overlay";
  overlay.style.cssText = "grid-area:1/1;position:relative;pointer-events:none";
  const badge = document.createElement("div");
  badge.id = "badge";
  badge.style.cssText = `position:absolute;left:${(size - dot) / 2}px;top:${(size - dot) / 2}px;width:${dot}px;height:${dot}px`;
  overlay.append(badge);
  stack.append(content, overlay);
  wrap.append(stack);
  document.body.append(wrap);
  if (masked) createCutout(content, overlay, { gap });
};

window.mount = mount;
window.MASKED_ATTRIBUTE = MASKED_ATTRIBUTE;
window.computeMaskStyle = computeMaskStyle;
