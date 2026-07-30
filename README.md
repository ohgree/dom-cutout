# dom-cutout

[![npm version](https://img.shields.io/npm/v/dom-cutout)](https://www.npmjs.com/package/dom-cutout)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/dom-cutout)](https://bundlephobia.com/package/dom-cutout)
[![license](https://img.shields.io/npm/l/dom-cutout)](./LICENSE)

Cut the silhouette of one DOM element out of another — badge cutouts, notification dots, status halos — with a runtime-generated SVG mask that follows the overlay's contours.

**[Live examples →](https://ohgree.github.io/dom-cutout/)**

The pattern you've seen on avatar status dots (Discord, Messenger): the badge doesn't just sit on top of the avatar, it _punches through_ it, leaving a crisp gap. Most implementations pre-bake a fixed mask per shape and position. `dom-cutout` measures the live DOM instead, so any overlay shape, any position, any size — including SVG glyphs, whose outline is traced contour-for-contour.

- **Zero-dependency core** — plain DOM, works with any framework or none
- **React adapter** at `dom-cutout/react`
- **Contour-following** — SVG overlays are traced via stroke expansion, so the gap reads as a halo around the actual glyph, not a box
- Keeps itself in sync via `ResizeObserver`; SSR-safe

## Install

```sh
npm install dom-cutout
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

Plus any `div` props — the wrapper is an `inline-grid` stacking the two layers.

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

`computeMaskUrl(content, overlay, options)` is also exported if you only want the generated `mask-image` value and full control over applying it.

## Shapes

- **`contour`** — traces the outline of the overlay's first `<svg>` by re-rendering its markup with a stroke of `2 × gap` plus the artwork's own stroke-width, so the visible gap stays `gap` even for stroke-based icons (lucide, feather, tabler). Rounded joins/caps.
- **`box`** — the overlay's bounding box (its first element child, falling back to the overlay itself), expanded by `gap`, respecting the target's computed `border-radius`. Works for dots, pills, counters.
- **`auto`** (default) — `contour` when the overlay contains an `<svg>`, else `box`.

## How it works

On each update, `dom-cutout` measures the content and overlay rects, builds a small self-contained SVG (`white` canvas + the overlay's shape in `black`), and sets it as the content element's `mask-image` (alpha mask: transparent = hidden) as a `data:` URI. No shared `<defs>`, no extra DOM, no stacking-context tricks. `ResizeObserver` re-runs measurement on size changes; the React adapter additionally recomputes before every paint, deduped by comparing the generated URL.

## Caveats

- Measurement uses `getBoundingClientRect`, so CSS transforms on the overlay or its ancestors skew the mask geometry. To rotate/scale an SVG overlay, put the transform inside the SVG (`<g transform="rotate(...)">`) — SVG-attribute transforms live in the markup and stay in sync with the mask.
- The first paint after mount is unmasked for one frame (the mask needs a layout pass to measure). With server-rendered/static markup the window lasts until your script runs — if it matters, hide the overlay initially (e.g. `visibility: hidden` inline) and reveal it after `createCutout`, or key CSS off the `data-cutout` attribute.
- `box` shape with a text-only overlay measures the overlay wrapper itself — wrap text in an element for accurate geometry.
- Stroke-width compensation reads SVG attributes (`stroke-width` on the root or per element); stroke-widths set via CSS classes or inline styles don't survive the markup copy and aren't compensated.

## Future plans

- **CSS transform support** — read the overlay's computed transform matrix and transplant it into the generated mask, so rotated/scaled overlays stay in sync without the in-SVG `<g transform>` workaround. Stays vector and synchronous.
- **Raster silhouettes** — a canvas-backed shape mode that cuts out whatever the overlay actually paints (`<img>` badges, emoji), plus soft/feathered halos. Additive to the SVG path, not a replacement: SVG masks stay resolution-independent and synchronous, which raster can't match for glyph overlays.

## Prior art

- [Thinking About The Cut-Out Effect: CSS or SVG?](https://ishadeed.com/article/thinking-about-the-cut-out-effect/) — Ahmad Shadeed's survey of the hand-rolled approaches
- CSS `mask-composite: exclude` covers simple fixed-shape cases without JavaScript

## License

[MIT](./LICENSE)
