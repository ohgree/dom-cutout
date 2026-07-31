# The WebKit masking journey

Why `dom-cutout` builds its mask the way it does — a gradient canvas minus a
small shape layer, composited with `mask-composite: subtract` — is not
obvious from the code. It is the sole survivor of a long elimination against
three distinct WebKit rendering behaviors, each discovered the hard way.
This document records the whole path so nobody (including us) re-walks it.

All measurements below are empirical: playwright-driven Chromium and WebKit,
screenshots at `deviceScaleFactor` 2–3, blend pixels counted on scanlines
across mask edges. iOS results verified on a physical iPhone.

## 1. The obvious construction, and the softness

A cutout mask needs "visible everywhere, except a hole." The classic way to
build that as a single CSS `mask-image` is an **alpha knockout**: a white
rect with the shape subtracted via an internal SVG `<mask>`:

```svg
<svg>
  <defs>
    <mask id="m">
      <rect fill="white" .../>   <!-- keep -->
      <path fill="black" .../>   <!-- cut -->
    </mask>
  </defs>
  <rect fill="white" mask="url(#m)"/>  <!-- opaque, with a transparent hole -->
</svg>
```

This works everywhere `mask-image` works. But on high-DPI displays, WebKit
renders the cutout edge ~1px softer than Chromium or Firefox (measured: 3
blend px vs 1 at 2×). The mask itself is binary vector; the softness is
introduced at rasterization: **WebKit rasterizes mask images that contain
internal `<mask>` elements at CSS-pixel resolution**, not device resolution.

## 2. Everything that does not fix the softness

All verified no-ops (screenshot byte-comparison or edge measurement):

- Oversampling the mask SVG's intrinsic `width`/`height` (2×, 8×)
- Every `viewBox` / `width` / `height` / `preserveAspectRatio` spelling
- Compositing-layer hints: `transform: translateZ(0)`, `will-change`,
  `isolation: isolate`
- `mask-mode: alpha` (image masks already default to alpha)
- `-webkit-mask-box-image` (same blur, different slicing geometry)
- SVG reference masks (`mask: url(#id)` pointing at in-document SVG) — not
  soft but **absent**: WebKit ignores them on HTML elements entirely

One genuinely crisp alternative surfaced early: wrapping the content in
`svg > foreignObject` and masking in SVG context renders vector-crisp in
every engine. Rejected as the library's approach because it restructures
the consumer's DOM: the vanilla API can't reparent elements it doesn't own,
`foreignObject` forfeits intrinsic sizing, and it constrains what the
content can be. A diagnostic-bench exhibit, not a default.

## 3. The internal-`<mask>` insight

A Stack Overflow thread ([#74233827](https://stackoverflow.com/questions/74233827))
about intermittent Safari mask blur pointed at the real variable: Safari
misbehaves specifically on mask images _containing masked elements_. Isolated
empirically at 2× on WebKit:

| structure                        | edge blend px |
| -------------------------------- | ------------- |
| alpha + internal `<mask>`        | 2             |
| luminance + internal `<mask>`    | 2             |
| luminance + simple SVG (no mask) | **0 — crisp** |

The internal `<mask>` is the trigger. The alpha knockout _requires_ one
(painting can't erase to transparency), but a **luminance mask** doesn't:
`mask-mode: luminance` reads white as visible and black as hidden, so a
plain white-canvas + black-shape SVG encodes the hole as color, no
indirection. Crisp at device resolution in WebKit, Chromium, and Firefox.

## 4. Luminance ships… and dies on an iPhone

The luminance mask became the library default — briefly. On-device testing
found masks _vanishing entirely_ on iOS: a 200 CSS px masked element showed
no cutout at all at rest, and a 96px one lost its cutout under light pinch
zoom, while the old alpha structure never failed.

The cause is [WebKit bug 282530](https://bugs.webkit.org/show_bug.cgi?id=282530).
In `Image::drawTiled` ([source](https://searchfox.org/wubkat/source/Source/WebCore/platform/graphics/Image.cpp)):

```cpp
#if PLATFORM(IOS_FAMILY)
    const float maxPatternTilePixels = 512 * 512;
#else
    const float maxPatternTilePixels = 2048 * 2048;
#endif
```

When one tile of the mask pattern exceeds this budget _in device pixels
after transforms_, WebKit falls back to a manual per-tile `draw()` loop that
doesn't carry the luminance-mask state — the image silently gets
reinterpreted as an alpha mask, and an all-opaque white/black image masks
nothing. Desktop bisection matched the constant exactly (renders at 1920
device px, gone at 2049); on an iPhone at DPR 3 the iOS budget is crossed by
a ~170 CSS px element **at rest**. Alpha masks never hit this because a
single-tile alpha image takes the early single-`draw()` fast path — which is
explicitly skipped when luminance is on.

Status at the time of writing: NEW, P2, unassigned. Luminance masking is
effectively unusable on iOS for arbitrary element sizes.

## 5. The composite dodge, v1: tile seams

The budget applies per pattern _tile_, and `mask-composite` lets a mask be
assembled from layers whose tiles stay small. Better: with two layers,
**no luminance is needed at all** — plain alpha layers can build the
knockout by composition:

- canvas layer: full coverage
- shape layer: just the (dilated) silhouette, small, `no-repeat`, positioned
- `mask-composite: subtract` → canvas minus shape = cutout

Because both layer images are simple SVGs (no internal `<mask>`), the
softness trigger is gone too: measured **0 blend px on WebKit at 2×**,
Chromium parity, and the knockout survives far past the tile budget.

First attempt used a tiny repeated white tile (16×16) as the canvas.
On-device it survived every pinch — but showed a **thin grid** over the
content on iOS: each tile edge is antialiased independently, and at
fractional effective scales (DPR × pinch) adjacent tiles don't quite abut.
Reproduced on desktop by forcing fractional geometry (8 seam px per
scanline).

## 6. The survivor: gradient canvas − shape

The canvas layer doesn't need an image at all. `linear-gradient(#000,#000)`
is a _generated_ image: full coverage, no tiles (nothing to seam, nothing
for the budget to inspect), no decode. The final construction:

```css
mask-image: linear-gradient(#000, #000), url("data:image/svg+xml,<shape>");
mask-position:
  0 0,
  <shape x>px <shape y>px;
mask-size:
  100% 100%,
  <shape w>px <shape h>px;
mask-repeat: no-repeat, no-repeat;
mask-composite: subtract, add;
```

Every property earns its place:

- **gradient canvas** — full coverage without tiles or budget exposure
- **standalone shape layer** — a small simple SVG: no internal `<mask>`
  (crisp), alpha coverage only (no `mask-mode`, so bug 282530 can't apply)
- **subtract** — the knockout that previously required the internal `<mask>`

Verified: 0 blend px in WebKit and Chromium at 2×; knockout intact at layer
sizes far past both budgets; no seams under fractional scale; on-device
iPhone — renders at rest at all sizes, survives any pinch, no grid.

Support boundary: `mask-composite` (Safari 15.4+, Chrome/Edge 120+, Firefox
53+ — Baseline widely available). On engines without it, layers combine
without subtraction into an all-opaque mask: the cutout simply doesn't
appear, content and overlay render normally.

## 7. Epilogue: the tile/decode race

One more iOS-only behavior surfaced after the composite shipped: on the
first paint of a mask whose shape-layer data URI WebKit had never seen,
content rendered with broken fragments — most of the element masked away.
The signatures gave the mechanism away: previously-seen gap values (cached
URIs) rendered fine, pinch-zooming in fixed it (re-raster after decode),
zooming back out restored the broken tiles (per-scale tile caches), and
reload fixed it (URI now in the memory cache).

iOS WebKit rasterizes content tiles while a freshly-seen mask image is
still decoding; those tiles composite with the shape layer missing and then
stick in the tile cache. The first mitigation attempt — waiting for the
decode before applying the mask — backfired instructively: it moved every
application past first paint, which itself churns tiles visibly for up to a
second on every load, and it opened an unmasked flash whenever a consumer
destroys/recreates the instance (the documented way to change options).

The shipped mitigation: fresh applications apply synchronously (pre-paint
on load), and swaps double-buffer. Safari paints a still-decoding mask
layer as fully transparent, and decoding a probe `Image` doesn't reliably
cover the CSS loader's own copy of the data URI — there is no JS-observable
moment when the CSS side is ready, so any single-mask replacement strategy
loses the race somewhere (immediate swaps blink; decode-predicted swaps
fragment sporadically; rAF-timed swaps blink on every change). The
transition mask keeps the OLD shape as an extra layer — gradient −
(new ∪ old) — so an undecoded new image contributes nothing and the old
mask keeps masking; once settled, a finalize pass collapses to the new
shape and schedules invisible sub-pixel `mask-position` nudges that
re-raster any tile painted against a stale image. Superseded updates
cancel pending finalizes via a token.

A related precision lesson: the shape image's intrinsic size and the
`mask-size` it is painted at must agree EXACTLY. A first snapping attempt
rounded only the CSS values, leaving the intrinsic size fractional — the
sub-pixel stretch read as a hairline ring at `gap: 0` on Chromium and as a
subtle cutout shift on Safari (which rounds the stretch the other way).
The layer geometry is snapped to the device-pixel grid once, the same
values feed the SVG markup and both mask longhands, and the artwork is
re-centered inside the snapped canvas. (Empirically, fractional element
positions alone shift nothing on desktop engines — measured symmetric at
every quarter-pixel offset — so the snap exists for geometry agreement and
iOS raster alignment, not as a general fraction-phobia.)

## Timeline of failure modes, for the record

| approach                       | desktop WebKit | iOS WebKit                | verdict                             |
| ------------------------------ | -------------- | ------------------------- | ----------------------------------- |
| alpha + internal `<mask>`      | ~1px soft      | works                     | shipped in 0.1.x                    |
| SVG reference mask             | ignored        | ignored                   | dead end                            |
| `svg > foreignObject` wrap     | crisp          | crisp                     | rejected: restructures consumer DOM |
| luminance, simple SVG          | crisp          | **vanishes** (bug 282530) | reverted                            |
| composite, tiled canvas        | crisp          | survives, **tile seams**  | superseded                          |
| **composite, gradient canvas** | **crisp**      | **crisp, survives pinch** | **current**                         |

The playwright suite in [`e2e/`](../e2e) guards each of these failure modes
against regressions.
