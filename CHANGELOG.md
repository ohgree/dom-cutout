# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Crisp cutout edges on Safari/WebKit.** The generated mask is now a luminance mask (`mask-mode: luminance`): a simple white-canvas + black-shape SVG with no internal `<mask>` element. WebKit rasterizes mask images that contain internal `<mask>` elements at CSS-pixel resolution (~1px soft edges on high-DPI displays), and the same structure is implicated in Safari's intermittent mask-rendering glitches — the luminance structure avoids that path entirely and renders at device resolution on every engine (WebKit, Chromium, Firefox).
- `mask-mode` is now required — [Baseline widely available](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mask-mode), all major engines since December 2023. On older engines the cutout gracefully doesn't appear (content and overlay render normally, without the gap). The `-webkit-`-prefixed mask properties are no longer set.
- The overlay artwork's paint colors are normalized to black in the mask copy, since luminance masks read color (`fill="none"`/`stroke="none"` are respected).

### Fixed

- The overlay layer no longer swallows pointer events aimed at `children` (it now has `pointer-events: none`; interactive overlay content can re-enable itself with its own `pointer-events: auto`).

### Known limitations

- WebKit silently drops masks past an internal rasterization-buffer cap: ~2048 device px per dimension of the masked element on desktop (~4096 for the old alpha structure); on iOS, deep pinch-zoom drops all masks on the page regardless of element size. Cutouts reappear once back under the limit.

## [0.1.1] - 2026-07-30

### Changed

- README: version/size/license badges, install commands for every package manager, live-examples link.

## [0.1.0] - 2026-07-30

Initial release: zero-dependency core (`createCutout`, `computeMaskUrl`, contour/box/auto shapes, stroke-width compensation, `ResizeObserver` syncing) and the React adapter at `dom-cutout/react`.

[unreleased]: https://github.com/ohgree/dom-cutout/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/ohgree/dom-cutout/releases/tag/v0.1.1
[0.1.0]: https://www.npmjs.com/package/dom-cutout/v/0.1.0
