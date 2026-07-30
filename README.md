# dom-cutout

[![npm version](https://img.shields.io/npm/v/dom-cutout)](https://www.npmjs.com/package/dom-cutout)
[![minzipped size](https://img.shields.io/bundlejs/size/dom-cutout)](https://bundlejs.com/?q=dom-cutout)
[![license](https://img.shields.io/npm/l/dom-cutout)](./LICENSE)

Cut the silhouette of one DOM element out of another — badge cutouts, notification dots, status halos — with a runtime-generated SVG mask that follows the overlay's contours.

**[Live examples →](https://ohgree.github.io/dom-cutout/)**

The pattern you've seen on avatar status dots (Discord, Messenger): the badge doesn't just sit on top of the avatar, it _punches through_ it, leaving a crisp gap. Most implementations pre-bake a fixed mask per shape and position. `dom-cutout` measures the live DOM instead, so any overlay shape, any position, any size — including SVG glyphs, whose outline is traced contour-for-contour.

- **Zero-dependency core** — plain DOM, works with any framework or none
- **React adapter** at `dom-cutout/react`
- **Contour-following** — SVG overlays are traced via stroke expansion, so the gap reads as a halo around the actual glyph, not a box
- **Crisp on every engine** — the mask construction was chosen by elimination against WebKit's rendering quirks ([the full story](./docs/webkit-masking.md))
- Keeps itself in sync via `ResizeObserver`; SSR-safe

## Install

```sh
npm install dom-cutout
# or: pnpm add dom-cutout / yarn add dom-cutout
```

## React

```tsx
import { Cutout } from "dom-cutout/react";

<Cutout gap={6} overlay={<StatusDot style={{ position: "absolute", bottom: 0, right: 0 }} />}>
  <Avatar />
</Cutout>;
```

The overlay renders on top of the children; its silhouette (expanded by `gap` pixels) is cut out of them. An overlay that renders nothing — nullish/`false`, or hidden via `display: none` — clears the mask, so conditional badges just work:

```tsx
<Cutout overlay={hasUnread && <NotificationDot />}>
  <BellIcon />
</Cutout>
```

### Props

| Prop       | Type                           | Default  |                                                                                                                        |
| ---------- | ------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `overlay`  | `ReactNode`                    | —        | Content whose silhouette is cut out of `children`. Position it within the overlay layer (e.g. `position: 'absolute'`). |
| `children` | `ReactNode`                    | —        | Content the cutout is carved out of.                                                                                   |
| `gap`      | `number`                       | `4`      | Gap width in rendered pixels between the overlay's silhouette and the content. Default exported as `DEFAULT_GAP`.      |
| `shape`    | `'auto' \| 'contour' \| 'box'` | `'auto'` | How the silhouette is traced (see below).                                                                              |
| `ref`      | `Ref<HTMLDivElement>`          | —        | Ref to the wrapper element stacking the two layers.                                                                    |

Plus any `div` props — the wrapper is an `inline-grid` stacking the two layers. The overlay layer carries `pointer-events: none` so `children` stay interactive; interactive overlay content re-enables itself with its own `pointer-events: auto`.

## Vanilla / other frameworks

```ts
import { createCutout } from "dom-cutout";

const instance = createCutout(contentEl, overlayEl, { gap: 6 });

// after DOM changes ResizeObserver can't see (same-size content swaps):
instance.update();

// removes the mask and all observers:
instance.destroy();
```

While a mask is applied, the content element carries a `data-cutout` attribute (exported as `MASKED_ATTRIBUTE`) — a hook for CSS or tests. An overlay that renders nothing — empty, whitespace/comments only, or zero-area (e.g. `display: none`) — clears the mask.

`computeMaskStyle(content, overlay, options)` is also exported if you want full control over applying the mask: it returns the CSS mask longhands as a property → value map (`mask-image`, `mask-position`, `mask-size`, `mask-repeat`, `mask-composite` — the list is exported as `MASK_PROPERTIES`), or `null` when the overlay renders nothing.

## Shapes

- **`contour`** — traces the outline of the overlay's first `<svg>` by re-rendering its markup with a stroke of `2 × gap` plus the artwork's own stroke-width, so the visible gap stays `gap` even for stroke-based icons (lucide, feather, tabler). Rounded joins/caps.
- **`box`** — the overlay's bounding box (its first element child, falling back to the overlay itself), expanded by `gap`, respecting the target's computed `border-radius`. Works for dots, pills, counters.
- **`auto`** (default) — `contour` when the overlay contains an `<svg>`, else `box`.

## How it works

On each update, `dom-cutout` measures the content and overlay rects and applies a two-layer composite mask: a full-coverage gradient canvas (`linear-gradient(#000,#000)`), minus a small standalone SVG containing just the dilated silhouette, positioned over the overlay via `mask-position` and combined with `mask-composite: subtract`. No shared `<defs>`, no extra DOM, no stacking-context tricks. `ResizeObserver` re-runs measurement on size changes; the React adapter additionally recomputes before every paint, deduped by comparing the generated properties.

The two-layer construction isn't incidental — it's the only one of six approaches that renders crisp at device resolution on every engine _and_ survives iOS: single-image masks with an internal SVG `<mask>` rasterize soft on high-DPI WebKit, and `mask-mode: luminance` masks silently stop masking on iOS past a 512×512 device-px budget ([WebKit bug 282530](https://bugs.webkit.org/show_bug.cgi?id=282530)). The elimination is documented in [docs/webkit-masking.md](./docs/webkit-masking.md).

## Caveats

- Measurement uses `getBoundingClientRect`, so CSS transforms on the overlay or its ancestors skew the mask geometry. To rotate/scale an SVG overlay, put the transform inside the SVG (`<g transform="rotate(...)">`) — SVG-attribute transforms live in the markup and stay in sync with the mask.
- The first paint after mount is unmasked for one frame (the mask needs a layout pass to measure). With server-rendered/static markup the window lasts until your script runs — if it matters, hide the overlay initially (e.g. `visibility: hidden` inline) and reveal it after `createCutout`, or key CSS off the `data-cutout` attribute.
- `box` shape with a text-only overlay measures the overlay wrapper itself — wrap text in an element for accurate geometry.
- Stroke-width compensation reads SVG attributes (`stroke-width` on the root or per element); stroke-widths set via CSS classes or inline styles don't survive the markup copy and aren't compensated.
- The overlay artwork's paint colors are normalized to black in the mask copy (`fill="none"`/`stroke="none"` are respected) — only the silhouette matters, but paints applied via CSS classes don't survive the copy, same as stroke-widths.

## Browser support

The composite mask needs `mask-composite` — [Baseline widely available](https://developer.mozilla.org/en-US/docs/Web/CSS/mask-composite) (Safari 15.4+, Chrome/Edge 120+, Firefox 53+). On older engines the layers combine into an all-opaque mask and the cutout simply doesn't appear: content and overlay render normally, just without the gap.

Why the mask is built this way — and why five simpler constructions were eliminated (soft edges from internal SVG `<mask>` elements, luminance masks silently dying on iOS via [WebKit bug 282530](https://bugs.webkit.org/show_bug.cgi?id=282530), tile seams under pinch zoom) — is documented in [docs/webkit-masking.md](./docs/webkit-masking.md). The playwright suite in [`e2e/`](./e2e) pins each of those failure modes.

## Future plans

- **CSS transform support** — read the overlay's computed transform matrix and transplant it into the generated mask, so rotated/scaled overlays stay in sync without the in-SVG `<g transform>` workaround. Stays vector and synchronous.
- **Raster silhouettes** — a canvas-backed shape mode that cuts out whatever the overlay actually paints (`<img>` badges, emoji), plus soft/feathered halos. Additive to the SVG path, not a replacement: SVG masks stay resolution-independent and synchronous, which raster can't match for glyph overlays.

## Why not a background-colored ring?

The workaround most UIs ship is a fake gap: give the badge a `border`, `box-shadow` spread, or `outline` in the page's background color. It looks right exactly until the background stops being one flat color — over a gradient, an image, a hover state, glassmorphism, or a themed surface, the "gap" is revealed as an opaque painted ring that doesn't match what's behind it. It also has to be maintained in lockstep with every background it ever sits on (light/dark themes ×2 minimum).

A mask doesn't paint the gap — it _removes_ content pixels, so whatever is actually behind the component shows through, automatically, on any backdrop. That's what the checkerboard in the [live examples](https://ohgree.github.io/dom-cutout/) demonstrates: the gap is genuine transparency, not paint.

## Prior art

- [Thinking About The Cut-Out Effect: CSS or SVG?](https://ishadeed.com/article/thinking-about-the-cut-out-effect/) — Ahmad Shadeed's survey of the hand-rolled approaches
- CSS `mask-composite: exclude` covers simple fixed-shape cases without JavaScript

## License

[MIT](./LICENSE)
