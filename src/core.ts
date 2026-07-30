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
  /**
   * How the generated mask knocks the silhouette out.
   * - `'luminance'` — simple SVG (white canvas, black shape) applied with
   *   `mask-mode: luminance`. Renders crisp at device resolution in every
   *   engine, but requires `mask-mode` support (Safari 15.4+, Chrome 120+,
   *   Firefox 53+).
   * - `'alpha'` — the shape is knocked out to transparency via an internal
   *   SVG `<mask>`. Works wherever `mask-image` works, but WebKit
   *   rasterizes this structure at CSS-pixel resolution (~1px soft edges
   *   on high-DPI displays).
   * - `'auto'` picks `'luminance'` when the browser supports it.
   * @default 'auto'
   */
  mode?: CutoutMode;
}

export type CutoutMode = "auto" | "luminance" | "alpha";

// WebKit rasterizes alpha image masks that contain internal <mask> elements
// at CSS-pixel resolution (soft edges on high-DPI), and that structure is
// also implicated in intermittent Safari rasterization bugs. A luminance
// mask needs no internal <mask> — white canvas + black shape as direct
// children — and rasterizes at device resolution everywhere (verified:
// WebKit/Chromium/Firefox). Detected once; `mask-mode` support implies
// support for everything else the luminance path uses.
let luminanceSupport: boolean | undefined;
const supportsLuminance = () =>
  (luminanceSupport ??=
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("mask-mode", "luminance"));

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
  { gap = DEFAULT_GAP, shape = "auto", mode = "auto" }: CutoutOptions = {},
): string | null => {
  const luminance = mode === "luminance" || (mode === "auto" && supportsLuminance());
  // An empty overlay means "no cutout". Whitespace and comment nodes don't
  // count as content (hand-written markup always contains them). Without
  // this, the box branch would measure the overlay element itself — often
  // stretched to the content's full size by the host layout — and cut out
  // everything.
  if (!overlay.querySelector("*") && !overlay.textContent?.trim()) return null;

  const contentRect = content.getBoundingClientRect();

  const svg = shape === "box" ? null : overlay.querySelector("svg");
  if (shape === "contour" && !svg) return null;

  let shapeMarkup: string;

  if (svg) {
    // Stroke expansion follows the glyph's contours uniformly, so the gap
    // reads as a halo around the actual shape rather than a box.
    const svgRect = svg.getBoundingClientRect();
    // A zero-area overlay (e.g. a display:none badge) renders nothing and
    // must clear the mask — and the viewBox scale divides by these.
    if (svgRect.width === 0 || svgRect.height === 0) return null;
    const x = svgRect.left - contentRect.left;
    const y = svgRect.top - contentRect.top;
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
    const clone = svg.cloneNode(true) as SVGSVGElement;
    for (const el of clone.querySelectorAll("[stroke-width]")) {
      const own = parseFloat(el.getAttribute("stroke-width") ?? "") || 0;
      el.setAttribute("stroke-width", String(own + dilation));
    }
    // Normalize paint colors to black: a luminance mask reads color (a red
    // fill would only half-hide), and broken paint-server references
    // (fill="url(#…)") never resolve inside a standalone mask image.
    // Harmless for alpha masks, where any non-none paint is opaque anyway.
    for (const attr of ["fill", "stroke"] as const) {
      for (const el of clone.querySelectorAll(`[${attr}]`)) {
        if (el.getAttribute(attr) !== "none") el.setAttribute(attr, "black");
      }
    }

    shapeMarkup = [
      `<svg x="${x}" y="${y}" width="${svgRect.width}" height="${svgRect.height}" viewBox="${viewBox}" overflow="visible">`,
      `<g fill="black" stroke="black" stroke-width="${dilation + rootStrokeWidth}" stroke-linejoin="round" stroke-linecap="round">`,
      clone.innerHTML,
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
    // A zero-area overlay (e.g. a display:none badge) renders nothing and
    // must clear the mask rather than trace a phantom gap-sized shape.
    if (targetRect.width === 0 || targetRect.height === 0) return null;
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
  //
  // Luminance structure: white canvas rect (visible) + shape in black
  // (cutout) as direct children, applied with `mask-mode: luminance`.
  // Alpha structure (fallback): the same canvas + shape inside an internal
  // <mask>, knocking a transparent hole into a white rect. WebKit
  // rasterizes mask images CONTAINING internal <mask> elements at
  // CSS-pixel resolution (~1px soft edges on high-DPI; verified), which is
  // why luminance is preferred wherever `mask-mode` is supported.
  const svgMarkup = luminance
    ? [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${contentRect.width}" height="${contentRect.height}">`,
        `<rect width="100%" height="100%" fill="white"/>`,
        shapeMarkup,
        `</svg>`,
      ].join("")
    : [
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
  "mask-mode",
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
    const { mode = "auto" } = options;
    const luminance = mode === "luminance" || (mode === "auto" && supportsLuminance());
    content.style.setProperty("mask-image", url);
    content.style.setProperty("mask-size", "100% 100%");
    content.style.setProperty("-webkit-mask-image", url);
    content.style.setProperty("-webkit-mask-size", "100% 100%");
    if (luminance) {
      content.style.setProperty("mask-mode", "luminance");
    } else {
      content.style.removeProperty("mask-mode");
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
      lastUrl = undefined;
      clearMask(content);
    },
  };
};
