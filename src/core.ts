export type CutoutShape = "auto" | "contour" | "box";

/** Default gap width in rendered pixels — the single source of the default. */
export const DEFAULT_GAP = 4;

export interface CutoutOptions {
  /**
   * Gap width in rendered pixels between the overlay's silhouette and the
   * content behind it.
   * @default 4
   */
  gap?: number;
  /**
   * How the overlay's silhouette is traced.
   * - `'contour'` follows the outline of the overlay's first `<svg>` via
   *   stroke expansion.
   * - `'box'` uses the overlay's bounding box, expanded by `gap` and
   *   respecting its computed `border-radius`.
   * - `'auto'` picks `'contour'` when the overlay contains an `<svg>`,
   *   `'box'` otherwise.
   * @default 'auto'
   */
  shape?: CutoutShape;
}

export interface CutoutInstance {
  /**
   * Recompute and re-apply the mask. Call after the overlay's content
   * changes in ways ResizeObserver can't see (e.g. same-size swaps).
   */
  update: () => void;
  /** Remove the mask, the data attribute, and all observers. */
  destroy: () => void;
}

/** Attribute set on the content element while a mask is applied. */
export const MASKED_ATTRIBUTE = "data-cutout";

/**
 * Compute the CSS `mask-image` url() that cuts the overlay's silhouette out
 * of the content element, or `null` when the overlay renders nothing.
 *
 * Pure measurement + string building: applies nothing to the DOM.
 */
export const computeMaskUrl = (
  content: Element,
  overlay: Element,
  { gap = DEFAULT_GAP, shape = "auto" }: CutoutOptions = {},
): string | null => {
  // An empty overlay means "no cutout". Without this, the box branch would
  // measure the overlay element itself — often stretched to the content's
  // full size by the host layout — and cut out everything.
  if (overlay.childNodes.length === 0) return null;

  const contentRect = content.getBoundingClientRect();

  const svg = shape === "box" ? null : overlay.querySelector("svg");
  if (shape === "contour" && !svg) return null;

  let shapeMarkup: string;

  if (svg) {
    // Stroke expansion follows the glyph's contours uniformly, so the gap
    // reads as a halo around the actual shape rather than a box.
    const svgRect = svg.getBoundingClientRect();
    const x = svgRect.left - contentRect.left;
    const y = svgRect.top - contentRect.top;
    const vb = svg.viewBox?.baseVal;
    const vbW = vb && vb.width > 0 ? vb.width : svgRect.width;
    const vbH = vb && vb.height > 0 ? vb.height : svgRect.height;
    const viewBox =
      vb && vb.width > 0
        ? `${vb.x} ${vb.y} ${vb.width} ${vb.height}`
        : `0 0 ${svgRect.width} ${svgRect.height}`;

    // Convert gap from rendered pixels to viewBox units.
    const scale = Math.max(vbW / svgRect.width, vbH / svgRect.height);
    const strokeWidth = gap * 2 * scale;

    shapeMarkup = [
      `<svg x="${x}" y="${y}" width="${svgRect.width}" height="${svgRect.height}" viewBox="${viewBox}" overflow="visible">`,
      `<g fill="black" stroke="black" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round">`,
      svg.innerHTML,
      `</g>`,
      `</svg>`,
    ].join("");
  } else {
    // Bounding box expanded by gap, following the target's border-radius.
    // Measure the overlay's first element child when present: the overlay
    // wrapper itself is frequently a positioning layer sized by the host
    // layout, not by the visible badge.
    const target = (overlay.firstElementChild ?? overlay) as Element;
    const targetRect = target.getBoundingClientRect();
    const x = targetRect.left - contentRect.left - gap;
    const y = targetRect.top - contentRect.top - gap;
    const w = targetRect.width + gap * 2;
    const h = targetRect.height + gap * 2;
    const br = getComputedStyle(target).borderRadius;
    const rx =
      (br.includes("%") ? (parseFloat(br) / 100) * targetRect.width : parseFloat(br) || 0) + gap;

    shapeMarkup = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="black"/>`;
  }

  // Self-contained SVG mask sized to the content element.
  // Inner <mask>: white rect (visible everywhere) + shape in black (cutout).
  // Outer rect with the mask applied → opaque white with transparent holes.
  // CSS mask-image uses alpha mode: transparent = hidden.
  const svgMarkup = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${contentRect.width}" height="${contentRect.height}">`,
    `<defs>`,
    `<mask id="_m" x="-50%" y="-50%" width="200%" height="200%">`,
    `<rect x="-50%" y="-50%" width="200%" height="200%" fill="white"/>`,
    shapeMarkup,
    `</mask>`,
    `</defs>`,
    `<rect width="100%" height="100%" fill="white" mask="url(#_m)"/>`,
    `</svg>`,
  ].join("");

  return `url("data:image/svg+xml,${encodeURIComponent(svgMarkup)}")`;
};

const MASK_PROPERTIES = [
  "mask-image",
  "mask-size",
  "-webkit-mask-image",
  "-webkit-mask-size",
] as const;

const clearMask = (content: HTMLElement) => {
  for (const property of MASK_PROPERTIES) {
    content.style.removeProperty(property);
  }
  content.removeAttribute(MASKED_ATTRIBUTE);
};

/**
 * Cut the overlay's silhouette out of the content element and keep the mask
 * in sync with size changes via ResizeObserver.
 *
 * The mask reflects current geometry at call time; call `update()` after
 * changes ResizeObserver can't observe. Returns an instance whose `destroy()`
 * removes the mask and all observers.
 */
export const createCutout = (
  content: HTMLElement,
  overlay: HTMLElement,
  options: CutoutOptions = {},
): CutoutInstance => {
  let lastUrl: string | null | undefined;

  const update = () => {
    const url = computeMaskUrl(content, overlay, options);
    if (url === lastUrl) return;
    lastUrl = url;

    if (url === null) {
      clearMask(content);
      return;
    }
    content.style.setProperty("mask-image", url);
    content.style.setProperty("mask-size", "100% 100%");
    content.style.setProperty("-webkit-mask-image", url);
    content.style.setProperty("-webkit-mask-size", "100% 100%");
    content.setAttribute(MASKED_ATTRIBUTE, "");
  };

  const resizeObserver =
    typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(update);
  resizeObserver?.observe(content);
  resizeObserver?.observe(overlay);

  update();

  return {
    update,
    destroy: () => {
      resizeObserver?.disconnect();
      lastUrl = undefined;
      clearMask(content);
    },
  };
};
