# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.2.0]: https://github.com/ohgree/dom-cutout/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/ohgree/dom-cutout/releases/tag/v0.1.1
[0.1.0]: https://www.npmjs.com/package/dom-cutout/v/0.1.0
