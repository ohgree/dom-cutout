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

/** The mask longhands `computeMaskStyle` returns and `destroy()` clears. */
export const MASK_PROPERTIES = [
  "mask-image",
  "mask-position",
  "mask-size",
  "mask-repeat",
  "mask-composite",
] as const;

/** The CSS mask longhands that render a cutout, as a property → value map. */
export type CutoutMaskStyle = Record<(typeof MASK_PROPERTIES)[number], string>;

/**
 * Compute the CSS mask longhands that cut the overlay's silhouette out of
 * the content element, or `null` when the overlay renders nothing.
 *
 * The mask is two composited alpha layers: a full-coverage gradient canvas,
 * `subtract`-ed by a small SVG image containing only the (dilated) shape.
 * This construction is deliberate, the survivor of a long WebKit
 * elimination (docs/webkit-masking.md):
 * - no internal `<mask>` in any mask image — WebKit rasterizes mask images
 *   containing one at CSS-pixel resolution (~1px soft edges on high-DPI);
 * - no `mask-mode: luminance` — WebKit silently stops honoring it past a
 *   pattern-tile budget of 512×512 device px on iOS (bug 282530), which an
 *   ordinary element crosses at rest;
 * - no repeated image tiles — antialiased tile edges seam into a visible
 *   grid at fractional zoom scales. The gradient canvas is a generated
 *   image: full coverage, no tiles, no budget.
 *
 * Pure measurement + string building: applies nothing to the DOM.
 */
export const computeMaskStyle = (
  content: Element,
  overlay: Element,
  { gap = DEFAULT_GAP, shape = "auto" }: CutoutOptions = {},
): CutoutMaskStyle | null => {
  // An empty overlay means "no cutout". Whitespace and comment nodes don't
  // count as content (hand-written markup always contains them). Without
  // this, the box branch would measure the overlay element itself — often
  // stretched to the content's full size by the host layout — and cut out
  // everything.
  if (!overlay.querySelector("*") && !overlay.textContent?.trim()) return null;

  const contentRect = content.getBoundingClientRect();

  const svg = shape === "box" ? null : overlay.querySelector("svg");
  if (shape === "contour" && !svg) return null;

  // The shape layer: a small standalone SVG image covering just the dilated
  // silhouette, placed over the content via mask-position/mask-size.
  let shapeSvg: string;
  let layer: { x: number; y: number; w: number; h: number };

  if (svg) {
    // Stroke expansion follows the glyph's contours uniformly, so the gap
    // reads as a halo around the actual shape rather than a box.
    const svgRect = svg.getBoundingClientRect();
    // A zero-area overlay (e.g. a display:none badge) renders nothing and
    // must clear the mask — and the viewBox scale divides by these.
    if (svgRect.width === 0 || svgRect.height === 0) return null;
    const vb = svg.viewBox?.baseVal;
    const vbW = vb && vb.width > 0 ? vb.width : svgRect.width;
    const vbH = vb && vb.height > 0 ? vb.height : svgRect.height;
    const viewBox =
      vb && vb.width > 0
        ? `${vb.x} ${vb.y} ${vb.width} ${vb.height}`
        : `0 0 ${svgRect.width} ${svgRect.height}`;

    // Convert gap from rendered pixels to viewBox units. The mask stroke
    // dilates the artwork by `dilation / 2` on each side of the path.
    const scale = Math.max(vbW / svgRect.width, vbH / svgRect.height);
    const dilation = gap * 2 * scale;

    // Stroked artwork renders its visible edge `strokeWidth / 2` outside
    // the path centerline, so the artwork's own stroke-widths must be added
    // on top of the dilation to keep the visible gap at `gap`: the root
    // attribute (dropped by the innerHTML copy) folds into the wrapping
    // <g>, and per-element attributes (which would override the <g> and
    // collapse that element's halo) are rewritten on a clone. CSS-driven
    // stroke-widths don't survive the copy and aren't compensated (README
    // caveat).
    const rootStrokeWidth = parseFloat(svg.getAttribute("stroke-width") ?? "") || 0;
    let maxOwnStrokeWidth = 0;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    for (const el of clone.querySelectorAll("[stroke-width]")) {
      const own = parseFloat(el.getAttribute("stroke-width") ?? "") || 0;
      maxOwnStrokeWidth = Math.max(maxOwnStrokeWidth, own);
      el.setAttribute("stroke-width", String(own + dilation));
    }
    // Normalize paint colors to black: broken paint-server references
    // (fill="url(#…)") never resolve inside a standalone mask image, and
    // for the knockout only the silhouette matters — any non-none paint is
    // equally opaque.
    for (const attr of ["fill", "stroke"] as const) {
      for (const el of clone.querySelectorAll(`[${attr}]`)) {
        if (el.getAttribute(attr) !== "none") el.setAttribute(attr, "black");
      }
    }

    // The layer image clips at its bounds, so pad it by the widest possible
    // stroke spill: gap (the dilation, in px) plus half the largest artwork
    // stroke, plus 1px slack for antialiasing.
    const pad = gap + Math.max(rootStrokeWidth, maxOwnStrokeWidth) / (2 * scale) + 1;
    layer = {
      x: svgRect.left - contentRect.left - pad,
      y: svgRect.top - contentRect.top - pad,
      w: svgRect.width + 2 * pad,
      h: svgRect.height + 2 * pad,
    };
    shapeSvg = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${layer.w}" height="${layer.h}">`,
      `<svg x="${pad}" y="${pad}" width="${svgRect.width}" height="${svgRect.height}" viewBox="${viewBox}" overflow="visible">`,
      `<g fill="black" stroke="black" stroke-width="${dilation + rootStrokeWidth}" stroke-linejoin="round" stroke-linecap="round">`,
      clone.innerHTML,
      `</g>`,
      `</svg>`,
      `</svg>`,
    ].join("");
  } else {
    // Bounding box expanded by gap, following the target's border-radius.
    // Measure the overlay's first element child when present: the overlay
    // wrapper itself is frequently a positioning layer sized by the host
    // layout, not by the visible badge.
    const target = (overlay.firstElementChild ?? overlay) as Element;
    const targetRect = target.getBoundingClientRect();
    // A zero-area overlay (e.g. a display:none badge) renders nothing and
    // must clear the mask rather than trace a phantom gap-sized shape.
    if (targetRect.width === 0 || targetRect.height === 0) return null;
    const br = getComputedStyle(target).borderRadius;
    const rx =
      (br.includes("%") ? (parseFloat(br) / 100) * targetRect.width : parseFloat(br) || 0) + gap;

    layer = {
      x: targetRect.left - contentRect.left - gap,
      y: targetRect.top - contentRect.top - gap,
      w: targetRect.width + gap * 2,
      h: targetRect.height + gap * 2,
    };
    shapeSvg = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${layer.w}" height="${layer.h}">`,
      `<rect width="100%" height="100%" rx="${rx}" fill="black"/>`,
      `</svg>`,
    ].join("");
  }

  return {
    "mask-image": `linear-gradient(#000,#000),url("data:image/svg+xml,${encodeURIComponent(shapeSvg)}")`,
    "mask-position": `0 0,${layer.x}px ${layer.y}px`,
    "mask-size": `100% 100%,${layer.w}px ${layer.h}px`,
    "mask-repeat": "no-repeat,no-repeat",
    "mask-composite": "subtract,add",
  };
};

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
  let lastKey: string | null | undefined;

  const update = () => {
    const style = computeMaskStyle(content, overlay, options);
    const key = style && JSON.stringify(style);
    if (key === lastKey) return;
    lastKey = key;

    if (style === null) {
      clearMask(content);
      return;
    }
    for (const property of MASK_PROPERTIES) {
      content.style.setProperty(property, style[property]);
    }
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
      lastKey = undefined;
      clearMask(content);
    },
  };
};
