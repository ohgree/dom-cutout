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
   * How the mask tracks overlay motion ResizeObserver can't see: CSS
   * transitions/animations, JS-driven transforms, scroll-linked movement.
   * - `true` (default): reactive. Mutation, transition/animation, and
   *   scroll detectors trigger a remeasure only when something actually
   *   happens, so an idle cutout costs nothing. Measurements run post-rAF
   *   pre-paint, so the mask lands in the same paint as the overlay.
   * - `'frame'`: remeasure every animation frame unconditionally - the
   *   escape hatch for motion the detectors can't see (pure
   *   `element.animate()`, layout shifts from outside the overlay).
   * - `false`: no motion tracking; size changes, re-renders, and manual
   *   `update()` only.
   * Read live, like every option.
   * @default true
   */
  follow?: boolean | "frame";
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
  "mask-clip",
] as const;

/** The CSS mask longhands that render a cutout, as a property → value map. */
export type CutoutMaskStyle = Record<(typeof MASK_PROPERTIES)[number], string>;

/**
 * Compute the CSS mask longhands that cut the overlay's silhouette out of
 * the content element, or `null` when the overlay renders nothing.
 *
 * The mask is two composited alpha layers: a full-coverage gradient canvas,
 * `subtract`-ed by a small SVG image containing only the (dilated) shape.
 * The construction is deliberate — the survivor of the WebKit elimination
 * recorded in docs/webkit-masking.md: no internal `<mask>` (WebKit
 * rasterizes those at CSS-pixel resolution — soft edges on high-DPI), no
 * `mask-mode: luminance` (dies past a 512×512 device-px tile budget on
 * iOS, bug 282530), no repeated tiles (seams at fractional zoom).
 *
 * Pure measurement + string building: applies nothing to the DOM.
 *
 * @example
 * ```ts
 * const style = computeMaskStyle(cardEl, badgeEl, { gap: 6 });
 * if (style) {
 *   for (const [property, value] of Object.entries(style)) {
 *     cardEl.style.setProperty(property, value);
 *   }
 * }
 * ```
 */
export const computeMaskStyle = (
  content: Element,
  overlay: Element,
  { gap = DEFAULT_GAP, shape = "auto" }: CutoutOptions = {},
): CutoutMaskStyle | null => {
  // An empty overlay means "no cutout"; whitespace/comment nodes don't count
  // (hand-written markup always has them). Without this, the box branch
  // measures the overlay element itself — often stretched to the content's
  // full size by the host layout — and cuts out everything.
  if (!overlay.querySelector("*") && !overlay.textContent?.trim()) return null;

  const contentRect = content.getBoundingClientRect();

  const svg = shape === "box" ? null : overlay.querySelector("svg");
  if (shape === "contour" && !svg) return null;

  // The shape layer: a small standalone SVG image covering just the dilated
  // silhouette, placed over the content via mask-position/mask-size.
  //
  // Geometry is snapped to the device-pixel grid, and the SAME snapped
  // values feed the SVG's intrinsic size and the mask-size: any mismatch
  // stretches the image sub-pixel - a hairline ring at gap 0 (Chromium), a
  // shifted cutout (Safari, rounding the other way). Positions MUST stay
  // snapped too: WebKit pixel-snaps the element's raster but honors
  // fractional mask placement, so an unsnapped mask wobbles up to half a
  // device pixel against a moving overlay (verified on Safari desktop and
  // iOS; Chromium renders both fractionally and never shows it - see
  // docs/webkit-masking.md §7). Consumers who want buttery tracking snap
  // the overlay's own motion to the device grid, as the examples do.
  const dpr = typeof devicePixelRatio === "number" && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const snap = (value: number) => Math.round(value * dpr) / dpr;
  // Measured sizes are steadied to 0.001px before they feed the markup:
  // composed ancestor transforms (a rotating carrier, a scaling wrapper)
  // leave floating-point dust on getBoundingClientRect, and any digit
  // change in the serialized SVG is a new mask URI - demoting every frame
  // of a tracked animation from the position fast path to the deferred
  // swap path, which stutters.
  const steady = (value: number) => Math.round(value * 1000) / 1000;
  let shapeSvg: string;
  let layer: { x: number; y: number; w: number; h: number };

  if (svg) {
    // Stroke expansion follows the glyph's contours uniformly, so the gap
    // reads as a halo around the actual shape rather than a box.
    const svgRect = svg.getBoundingClientRect();
    const svgW = steady(svgRect.width);
    const svgH = steady(svgRect.height);
    // A zero-area overlay (e.g. a display:none badge) renders nothing and
    // must clear the mask — and the viewBox scale divides by these.
    if (svgW === 0 || svgH === 0) return null;
    const vb = svg.viewBox?.baseVal;
    const vbW = vb && vb.width > 0 ? vb.width : svgW;
    const vbH = vb && vb.height > 0 ? vb.height : svgH;
    const viewBox =
      vb && vb.width > 0 ? `${vb.x} ${vb.y} ${vb.width} ${vb.height}` : `0 0 ${svgW} ${svgH}`;

    // Convert gap from rendered pixels to viewBox units. The mask stroke
    // dilates the artwork by `dilation / 2` on each side of the path.
    const scale = Math.max(vbW / svgW, vbH / svgH);
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
    // stroke, plus 1px slack for antialiasing. The artwork is re-centered
    // in the snapped canvas so snapping never skews the halo.
    const pad = gap + Math.max(rootStrokeWidth, maxOwnStrokeWidth) / (2 * scale) + 1;
    const w = snap(svgW + 2 * pad);
    const h = snap(svgH + 2 * pad);
    layer = {
      x: snap(svgRect.left - contentRect.left + svgW / 2 - w / 2),
      y: snap(svgRect.top - contentRect.top + svgH / 2 - h / 2),
      w,
      h,
    };
    shapeSvg = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`,
      `<svg x="${(w - svgW) / 2}" y="${(h - svgH) / 2}" width="${svgW}" height="${svgH}" viewBox="${viewBox}" overflow="visible">`,
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
    const targetW = steady(targetRect.width);
    const targetH = steady(targetRect.height);
    // A zero-area overlay (e.g. a display:none badge) renders nothing and
    // must clear the mask rather than trace a phantom gap-sized shape.
    if (targetW === 0 || targetH === 0) return null;
    // Resolve over-large radii the way CSS does (scale down uniformly — a
    // rounded-full pill keeps circular corners) before emitting the rect,
    // which would clamp rx/ry independently into elliptical corners.
    // "infinity" catches calc(infinity * 1px) handed back unresolved, which
    // parseFloat would read as 0.
    const br = getComputedStyle(target).borderRadius;
    const parsed = br.includes("infinity") ? Infinity : parseFloat(br) || 0;
    let rx: number;
    let ry: number;
    if (br.includes("%")) {
      // Percentage radii resolve per axis: legitimately elliptical corners.
      const fraction = Math.min(parsed, 50) / 100;
      rx = fraction * targetW + gap;
      ry = fraction * targetH + gap;
    } else {
      rx = ry = Math.min(parsed, targetW / 2, targetH / 2) + gap;
    }

    const w = snap(targetW + gap * 2);
    const h = snap(targetH + gap * 2);
    layer = {
      x: snap(targetRect.left - contentRect.left + targetW / 2 - w / 2),
      y: snap(targetRect.top - contentRect.top + targetH / 2 - h / 2),
      w,
      h,
    };
    shapeSvg = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`,
      `<rect width="100%" height="100%" rx="${rx}" ry="${ry}" fill="black"/>`,
      `</svg>`,
    ].join("");
  }

  return {
    "mask-image": `linear-gradient(#000,#000),url("data:image/svg+xml,${encodeURIComponent(shapeSvg)}")`,
    "mask-position": `0 0,${layer.x}px ${layer.y}px`,
    "mask-size": `100% 100%,${layer.w}px ${layer.h}px`,
    "mask-repeat": "no-repeat,no-repeat",
    "mask-composite": "subtract,add",
    // no-clip: the default border-box clip follows the element's ROUNDED
    // border box, so corner antialiasing applies twice (paint α × mask α)
    // and a thin under-covered fringe rims every masked rounded corner.
    // Un-clipped, the rect layers cover the corner AA fully — the layer
    // geometry above already bounds the mask to the element. WebKit parses
    // no-clip but ignores it; its fringe is a documented limitation
    // (docs/webkit-masking.md).
    "mask-clip": "no-clip,no-clip",
  };
};

const clearMask = (content: HTMLElement) => {
  for (const property of MASK_PROPERTIES) {
    content.style.removeProperty(property);
  }
  content.removeAttribute(MASKED_ATTRIBUTE);
};

// Safari hides the masked element while ANY image in its mask list is
// still loading — swapping in a mask the CSS engine hasn't seen blinks the
// children out, while re-applying a previously-seen mask is clean. The
// reuse is keyed on the property value TEXT (WebKit pools CSS values by
// their full string), so warming must apply the IDENTICAL mask longhands
// — same value strings, same property — to a hidden warm element; a
// background-image warm or an HTMLImageElement probe primes the wrong
// entry and changes nothing.
let warmElement: HTMLElement | null = null;
const warmMask = (style: CutoutMaskStyle) => {
  if (typeof document === "undefined" || !document.body) return;
  if (!warmElement || !warmElement.isConnected) {
    warmElement = document.createElement("div");
    warmElement.setAttribute("aria-hidden", "true");
    warmElement.style.cssText =
      "position:fixed;left:-9999px;top:0;width:1px;height:1px;pointer-events:none;visibility:hidden;background:#000";
    document.body.append(warmElement);
  }
  for (const property of MASK_PROPERTIES) {
    warmElement.style.setProperty(property, style[property]);
  }
};

// Transitions announce themselves at creation (transitionrun); animations
// only once they play (animationstart). Both bubble from the overlay subtree.
const FOLLOW_ANIMATION_EVENTS = ["transitionrun", "animationstart"] as const;

const nextFrame = (callback: () => void) => {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => requestAnimationFrame(callback));
  } else {
    setTimeout(callback, 32);
  }
};

/**
 * Cut the overlay's silhouette out of the content element and keep the mask
 * in sync: size changes via ResizeObserver, overlay motion via the `follow`
 * option's reactive detectors (on by default).
 *
 * The mask reflects current geometry at call time; call `update()` after
 * changes nothing here can observe (or set `follow: 'frame'` to remeasure
 * every frame). Returns an instance whose `destroy()` removes the mask and
 * all observers.
 *
 * @example
 * ```ts
 * const instance = createCutout(cardEl, badgeEl, { gap: 6 });
 * instance.update(); // after DOM changes ResizeObserver can't see
 * instance.destroy(); // on teardown
 * ```
 */
export const createCutout = (
  content: HTMLElement,
  overlay: HTMLElement,
  options: CutoutOptions = {},
): CutoutInstance => {
  let lastKey: string | null | undefined;
  let applyToken = 0;
  let appliedImage: string | null = null;
  let followFrame = 0;
  let jigglePending = false;
  let probe: HTMLElement | null = null;

  // A follow measurement is never taken where its trigger fired: rAF
  // callbacks and mutation microtasks run before other writers finish the
  // frame, so measuring there can trail the overlay by a full frame (the
  // badge outruns its halo) or force layout mid-frame. poke() instead
  // jiggles a hidden probe watched by the instance's ResizeObserver: RO
  // delivers after ALL rAF callbacks and before paint, so update() reads
  // settled geometry and the fast path applies into the same paint.
  const poke = () => {
    if (jigglePending) return;
    if (resizeObserver && typeof document !== "undefined" && document.body) {
      jigglePending = true;
      if (!probe || !probe.isConnected) {
        probe = document.createElement("div");
        probe.setAttribute("aria-hidden", "true");
        probe.style.cssText =
          "position:fixed;left:-9999px;top:0;width:1px;height:1px;pointer-events:none;visibility:hidden";
        document.body.append(probe);
        resizeObserver.observe(probe);
      }
      probe.style.width = probe.style.width === "1px" ? "2px" : "1px";
    } else {
      update();
    }
  };

  const hasRunningAnimations = () =>
    typeof overlay.getAnimations === "function" &&
    overlay.getAnimations({ subtree: true }).some((a) => a.playState === "running");

  // Running CSS transitions/animations mutate nothing the MutationObserver
  // can see, so their start events arm this loop instead; it lives exactly
  // as long as a subtree animation runs (plus one settling poke), or
  // indefinitely in 'frame' mode.
  const followLoop = () => {
    followFrame = 0;
    if (options.follow === false) return;
    poke();
    if (options.follow === "frame" || hasRunningAnimations()) armFollowLoop();
  };
  const armFollowLoop = () => {
    if (followFrame || typeof requestAnimationFrame !== "function") return;
    followFrame = requestAnimationFrame(followLoop);
  };

  const apply = (style: CutoutMaskStyle) => {
    for (const property of MASK_PROPERTIES) {
      content.style.setProperty(property, style[property]);
    }
    appliedImage = style["mask-image"];
    content.setAttribute(MASKED_ATTRIBUTE, "");
  };

  const update = () => {
    jigglePending = false;
    if (options.follow === "frame") armFollowLoop();
    const style = computeMaskStyle(content, overlay, options);
    const key = style && JSON.stringify(style);
    if (key === lastKey) return;
    lastKey = key;
    const token = ++applyToken;

    if (style === null) {
      appliedImage = null;
      clearMask(content);
      return;
    }

    // iOS stuck-tile repair: WebKit can rasterize tiles while the mask's
    // data URI is still decoding on the CSS side, and broken tiles stick
    // until a re-raster. After applying, invisible sub-pixel mask-position
    // nudges force re-rasters. Superseded updates cancel via the token.
    const nudge = (delta: number) => {
      if (token !== applyToken) return;
      const nudged = style["mask-position"].replace(
        /,(-?[\d.]+)px/,
        (_, x) => `,${Number(x) + delta}px`,
      );
      content.style.setProperty("mask-position", nudged);
    };
    const applyWithRepair = () => {
      if (token !== applyToken) return;
      apply(style);
      nextFrame(() => nudge(0.01));
      setTimeout(() => nudge(0.02), 250);
    };

    // Position-only fast path: with the applied image unchanged, only
    // mask-position can differ (size, repeat, composite, and clip all derive
    // from the same snapped geometry baked into the image), and the URI is
    // already resolved in Safari's CSS image cache - write synchronously.
    // This is what makes per-frame tracking of a moving overlay viable: the
    // warm/two-frame swap below would defer every frame and each new frame
    // would supersede the one before it, freezing the mask until rest. The
    // token bump above cancels any still-pending repair pair, so an
    // equivalent one is rescheduled.
    if (content.hasAttribute(MASKED_ATTRIBUTE) && style["mask-image"] === appliedImage) {
      content.style.setProperty("mask-position", style["mask-position"]);
      nextFrame(() => nudge(0.01));
      setTimeout(() => nudge(0.02), 250);
      return;
    }

    if (content.hasAttribute(MASKED_ATTRIBUTE)) {
      // Swap (e.g. a gap change): only a mask value Safari has already
      // resolved swaps without blinking the children out, so warm the
      // identical longhands first (see warmMask) and swap two frames later.
      // The old mask stays applied in the meantime.
      warmMask(style);
      nextFrame(applyWithRepair);
      return;
    }

    // Fresh application: apply synchronously — pre-paint on load, so clean
    // loads never churn tiles — and let the repair nudges cover a decode
    // that loses the race with the first paint.
    applyWithRepair();
  };

  const resizeObserver =
    typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(update);
  resizeObserver?.observe(content);
  resizeObserver?.observe(overlay);

  // Reactive follow, the default: detectors that cost nothing at idle cover
  // the motion sources - overlay mutations (JS animation drivers write
  // inline styles every frame), transition/animation starts (which then
  // mutate nothing while running - hence the loop), and scrolling. Each
  // trigger is a deduped poke; `follow: false` mutes them all.
  const onMotion = () => {
    if (options.follow !== false) poke();
  };
  const onAnimationStart = () => {
    if (options.follow !== false) armFollowLoop();
  };
  const mutationObserver =
    typeof MutationObserver === "undefined" ? undefined : new MutationObserver(onMotion);
  mutationObserver?.observe(overlay, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });
  for (const type of FOLLOW_ANIMATION_EVENTS) overlay.addEventListener(type, onAnimationStart);
  const scrollTarget = typeof document === "undefined" ? undefined : document;
  scrollTarget?.addEventListener("scroll", onMotion, { capture: true, passive: true });

  update();

  return {
    update,
    destroy: () => {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      for (const type of FOLLOW_ANIMATION_EVENTS) {
        overlay.removeEventListener(type, onAnimationStart);
      }
      scrollTarget?.removeEventListener("scroll", onMotion, { capture: true });
      if (followFrame) cancelAnimationFrame(followFrame);
      followFrame = 0;
      jigglePending = false;
      probe?.remove();
      probe = null;
      applyToken++;
      lastKey = undefined;
      appliedImage = null;
      clearMask(content);
    },
  };
};
