# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-08-02

### Changed

- **Breaking:** `<Cutout>` no longer wraps its children — the child element is cloned with a merged ref and masked directly, and the overlay renders in a single absolutely-positioned sibling layer pinned to the child's box via CSS anchor positioning (Baseline 2026: Chrome 125+, Firefox 132+, Safari 26+). Wrapping something in `<Cutout>` can no longer change how it lays out. The anchor rules are emitted as a rendered `<style>` element (declarative, polyfillable with `@oddbird/css-anchor-positioning`); engines without anchor support keep the layer's `inset: 0` base — it stretches the nearest positioned ancestor, like a hand-positioned badge — and a one-time console warning names the requirement and the polyfill. In exchange, `children` must now be a single element that accepts a ref (on React 18, custom components need `forwardRef`), and the wrapper-era `className`/`style`/div props and `ref` prop are gone since there is no wrapper to receive them.

### Added

- `useCutout` — headless React hook: attach `contentRef`/`overlayRef` to elements you own and the library inserts no DOM at all. The `<Cutout>` component is now a thin layer over it.

### Fixed

- Rounded-corner fringe on masked elements: the mask's default border-box clip follows the element's rounded corners, double-applying their antialiasing (paint α × mask α) — a thin line of backdrop rimming the arc, most visible with gradient backgrounds on elements masked directly (the wrapperless React adapter's normal case). The mask now sets `mask-clip: no-clip`, rendering masked corners identical to unmasked on Chromium/Firefox; WebKit parses but ignores the value and keeps a ≤1-device-px fringe (documented in docs/webkit-masking.md §6).
- Box-shape cutouts around pill-shaped overlays: an over-large `border-radius` (Tailwind's `rounded-full` `calc(infinity * 1px)`, or conventional `999px`-style values) produced elliptical corners instead of the element's actual pill silhouette — an SVG `<rect>` clamps `rx`/`ry` per axis, while CSS scales an over-large radius down uniformly. The radius is now resolved with CSS overlap semantics before the rect is emitted, `calc(infinity * 1px)` is recognized even where the engine hands it back unresolved, and percentage radii resolve per axis (elliptical corners preserved) with both `rx` and `ry` written to the mask.

## [0.2.2] - 2026-07-31

### Fixed

- Safari (desktop and iOS): sporadic fragmenting during fast slider drags — revisited gap values decode instantly from cache, letting several mask swaps land within one frame; swap applications are now coalesced to at most one per frame (latest style wins).
- iOS WebKit: sporadic fragmenting during slider-style rapid mask changes — probing an `Image` decode doesn't reliably cover the CSS mask loader's own copy of the data URI, so every mask application now schedules invisible sub-pixel repair nudges (two frames later and at 250ms) that re-raster the layer once the image is decoded everywhere.
- Safari: children no longer blink out while a changed mask decodes — when the element is already masked (e.g. a gap change), the previous mask stays applied and the new one swaps in once its image is decoded. The React adapter and the examples now keep one instance per element and change options via live mutation + `update()` instead of destroy/recreate.
- iOS WebKit: fragmented/stuck rendering on the first paint of a freshly-generated mask (new gap values, first load) — content tiles rasterized while the mask's shape image was still decoding, and the broken tiles stuck in the tile cache until a pinch-zoom or reload. The mask still applies synchronously (pre-paint on load, no flicker on updates); the shape image is decoded in parallel, and if the decode settles only after a frame has painted, an invisible 0.01px mask-position nudge re-rasterizes the layer against the decoded image.
- Sub-pixel geometry disagreement between the shape image's intrinsic size and `mask-size` stretched the mask by a hair — a hairline ring at `gap: 0` on Chromium, a subtle cutout shift on Safari. The layer geometry is now snapped to the device-pixel grid once and the same values feed the SVG markup, `mask-size`, and `mask-position`, with the artwork re-centered in the snapped canvas.

### Known limitations

- iOS can show a ≤1-device-px residual seam at `gap: 0` in some placements — iOS's internal raster alignment, not reachable from CSS; desktop engines are exact.

## [0.2.1] - 2026-07-31

### Documentation

- Documentation-only release to refresh the npm README: logo header, new tagline, the before/after demo animation (lossless WebP with transparent background, GIF fallback), the background-colored-ring comparison, and the WebKit story. No runtime changes.

## [0.2.0] - 2026-07-31

### Changed

- **Crisp cutout edges on every engine, including Safari/WebKit.** The mask is now a two-layer alpha composite — a gradient canvas (`linear-gradient(#000,#000)`) minus a small standalone shape layer, via `mask-composite: subtract` — replacing the single-image alpha knockout. The old structure's internal SVG `<mask>` made WebKit rasterize the mask at CSS-pixel resolution (~1px soft edges on high-DPI); the composite construction has no internal `<mask>`, no `mask-mode: luminance` (silently broken on iOS past a 512×512 device-px budget, [WebKit bug 282530](https://bugs.webkit.org/show_bug.cgi?id=282530)), and no repeated tiles (seams under fractional zoom). The full elimination is documented in [docs/webkit-masking.md](./docs/webkit-masking.md); verified on-device on iOS including deep pinch zoom.
- **Breaking:** `computeMaskUrl` is replaced by `computeMaskStyle`, which returns the CSS mask longhands as a property → value map (a layered mask can't be expressed as one `mask-image` value). The applied property list is exported as `MASK_PROPERTIES`; `createCutout`/`<Cutout>` usage is unchanged.
- `mask-composite` support is now required (Baseline widely available: Safari 15.4+, Chrome/Edge 120+, Firefox 53+); on older engines the cutout gracefully doesn't appear. The `-webkit-`-prefixed mask properties are no longer set.
- The overlay artwork's paint colors are normalized to black in the mask copy (`fill="none"`/`stroke="none"` are respected) — fixes silhouettes for artwork using paint-server references (`fill="url(#…)"`), which never resolve inside a standalone mask image.

### Fixed

- The overlay layer no longer swallows pointer events aimed at `children` (it now has `pointer-events: none`; interactive overlay content can re-enable itself with its own `pointer-events: auto`).

### Added

- A playwright regression suite (`e2e/`, `pnpm test:e2e`) that pins the WebKit failure modes discovered during development: edge crispness at 2×, mask survival past the pattern-tile budgets, seam-free rendering at fractional scales, and click-through to interactive children.

## [0.1.1] - 2026-07-30

### Changed

- README: version/size/license badges, install commands for every package manager, live-examples link.

## [0.1.0] - 2026-07-30

Initial release: zero-dependency core (`createCutout`, `computeMaskUrl`, contour/box/auto shapes, stroke-width compensation, `ResizeObserver` syncing) and the React adapter at `dom-cutout/react`.

[0.3.0]: https://github.com/ohgree/dom-cutout/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/ohgree/dom-cutout/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/ohgree/dom-cutout/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/ohgree/dom-cutout/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/ohgree/dom-cutout/releases/tag/v0.1.1
[0.1.0]: https://www.npmjs.com/package/dom-cutout/v/0.1.0
