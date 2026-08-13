import { Bell, Flame, Star, Zap } from "lucide-react";
import {
  AnimatePresence,
  m,
  type MotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { type CSSProperties, type ReactNode, type Ref, useRef, useState } from "react";

import { Cutout } from "dom-cutout/react";

// Full-page scroll tour: the container spans each scene's `span` in
// viewport-heights (default 1), a sticky stage pins to the screen, and
// scroll progress picks the scene.
// Every demo is the wrapperless <Cutout> from the package itself.
//
// Enter/exit animations are opacity + translate ONLY on anything containing
// a cutout: translation shifts content and overlay rects equally, so masks
// measured mid-animation stay correct — scale or rotation would skew them.

// Photos are hot-linked from the Unsplash CDN, never committed here: the
// Unsplash API guidelines ask for hot-linking over re-hosting, and the
// examples stay free of binary assets. Animals rather than people — the
// Unsplash License covers the photograph, not a subject's likeness.
// The gradient underneath is the offline/loading fallback, so the shapes
// (and therefore the cutouts) read even when the CDN doesn't answer.
// 512² so the largest avatar (160 CSS px) still has pixels to spare on a 3x
// display; webp keeps that under ~40 kB.
const photo = (id: string) => `https://images.unsplash.com/${id}?w=512&h=512&fit=crop&fm=webp&q=80`;

// Photo and initials avatars mixed, the way a real stack renders: uploaded
// pictures next to generated fallbacks. `tint` is the gradient — the whole
// avatar for an initials face, the offline placeholder behind a photo.
interface Face {
  tint: string;
  src?: string;
  initials?: string;
}

const FACES: Face[] = [
  // cat
  {
    tint: "from-stone-400 to-stone-600",
    src: photo("photo-1698495076223-0adb87d95eac"),
  },
  { tint: "from-emerald-500 to-teal-600", initials: "AS" },
  // duck
  {
    tint: "from-teal-400 to-cyan-600",
    src: photo("photo-1578102487209-9229fa2b1cfb"),
  },
  // hamster
  {
    tint: "from-amber-300 to-orange-500",
    src: photo("photo-1721327900411-b315dce4388e"),
  },
];

// ref-forwarding matters: <Cutout> masks its child by cloned ref, so a
// component that drops the ref silently never gets a mask.
// Safari fringe workaround: the paint AND the radius live on an inner
// element, so the masked box stays a sharp rectangle. WebKit clips masks to
// the rounded border box regardless of mask-clip, double-applying corner
// antialiasing (docs/webkit-masking.md §8) — a sharp-cornered masked box has
// no corner AA to double.
const Avatar = ({
  className = "h-28 w-28",
  face = FACES[0],
  style,
  ref,
}: {
  className?: string;
  face?: Face;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}) => (
  // Font size is inherited, so a caller sizing the avatar with `text-*` sizes
  // the initials with it.
  <div ref={ref} className={className} style={style}>
    <div
      className={`flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-linear-to-br ${face.tint} font-semibold text-white`}
    >
      {face.src ? (
        <img src={face.src} alt="" className="h-full w-full object-cover" />
      ) : (
        face.initials
      )}
    </div>
  </div>
);

const Code = ({ children }: { children: string }) => (
  <code className="text-base-content/60 block font-mono text-[13px]">{children}</code>
);

const SceneTitle = ({ title, blurb }: { title: string; blurb: string }) => (
  <div className="max-w-90">
    <h3 className="text-base-content mb-2 text-2xl font-semibold tracking-tight">{title}</h3>
    <p className="text-base-content/60 text-sm leading-relaxed">{blurb}</p>
  </div>
);

const chip = "chip cursor-pointer";
const chipActive = "chip cursor-pointer border-primary text-primary";

interface SceneProps {
  progress: MotionValue<number>;
  /** This scene's [start, end] slice of the page scroll progress. */
  range: readonly [number, number];
}

// Scroll-cycled selection: the scene's slice divides into equal zones, and
// crossing a boundary picks that zone's option. Selection only changes ON
// the crossing, so the picker buttons still work as direct overrides - a
// click holds until the next boundary. Each crossing is one discrete mask
// swap through the Safari-safe warm path, the same cost as a click.
const useScrollCycle = (
  progress: MotionValue<number>,
  range: readonly [number, number],
  count: number,
  onZone: (zone: number) => void,
) => {
  const lastZone = useRef(-1);
  useMotionValueEvent(progress, "change", (p) => {
    const [start, end] = range;
    const local = Math.min(1, Math.max(0, (p - start) / (end - start)));
    // Dead zones bracket the cycle: the first and last options hold through
    // the slice's outer 15%, so both ends are inspectable at rest.
    const t = Math.min(1, Math.max(0, (local - 0.15) / 0.7));
    const zone = Math.min(count - 1, Math.floor(t * count));
    if (zone !== lastZone.current) {
      lastZone.current = zone;
      onZone(zone);
    }
  });
};

/* Scene 1 — the cut itself, centered and huge. The flame rides the scroll
   along the avatar's circular border, top-right down to its bottom-right
   home (dead zones bracket the move), so default follow tracking is on
   display from the first scene. */
const BADGE = 48;
const AVATAR = 160;
const INSET = 4; // corner inset of the flame's bottom-right home
const CENTER = AVATAR / 2;
// Arc radius through the home point; the flame parks at the arc's
// rightmost point inside a carrier that rotates about the avatar center.
const ORBIT_R = (AVATAR - INSET - BADGE / 2 - CENTER) * Math.SQRT2;
const ORBIT_X = CENTER + ORBIT_R - BADGE / 2;
const ORBIT_Y = CENTER - BADGE / 2;

const CutScene = ({ progress, range }: SceneProps) => {
  const [shown, setShown] = useState(true);
  // The flame rests top-right through the first 20% of this scene's slice,
  // arcs until 80%, then sits at its home - both ends inspectable at rest.
  const traversal = (p: number) => {
    const [start, end] = range;
    const local = Math.min(1, Math.max(0, (p - start) / (end - start)));
    return Math.min(1, Math.max(0, (local - 0.2) / 0.6));
  };
  // The arc is driven by ROTATION, not left/top: WebKit raster-snaps layout
  // positions to whole device pixels, so two-axis coordinate motion
  // staircases visibly, while transformed content renders sub-pixel in
  // every engine. The flame counter-rotates so the glyph stays upright
  // (net identity, so the measured box matches the mask copy), and
  // will-change stays off so neither layer leaves the main-thread paint
  // world the mask commits in.
  const rotate = useTransform(progress, (p) => (traversal(p) - 0.5) * 90);
  const counterRotate = useTransform(rotate, (deg) => -deg);
  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <Cutout
        gap={5}
        overlay={
          shown && (
            <m.span
              className="absolute inset-0 block"
              style={{ rotate, willChange: "auto" }}
            >
              <m.span
                className="absolute block h-12 w-12"
                style={{ left: ORBIT_X, top: ORBIT_Y, rotate: counterRotate, willChange: "auto" }}
              >
                <Flame
                  size={BADGE}
                  className="fill-orange-500 stroke-orange-800"
                  strokeWidth={1.5}
                />
              </m.span>
            </m.span>
          )
        }
      >
        <Avatar className="h-40 w-40" />
      </Cutout>
      <SceneTitle
        title="The overlay punches through"
        blurb="One call. The badge doesn't sit on the avatar — its silhouette is cut out of it, and whatever is behind shows through the gap."
      />
      <button type="button" className={chip} onClick={() => setShown((v) => !v)}>
        overlay: {shown ? "shown" : "null — mask cleared"}
      </button>
      <Code>{shown ? "createCutout(avatar, badge)" : "// empty overlay ⇒ no mask"}</Code>
    </div>
  );
};

/* Scene 2 — gap, demoed on an overlapping "seen by" avatar stack. */

// Geometry the stack and the cuts share: each avatar is AVATAR_SIZE wide and
// starts STACK_STEP after the previous one, so the neighbour's circle sits at
// x = STACK_STEP inside the avatar it overlaps.
const AVATAR_SIZE = 64;
const STACK_STEP = 44;

// Descending z-index reverses the natural paint order so the FIRST avatar
// sits on top and each one after tucks in behind its left neighbour.
// Entrance is opacity ONLY: the mask rides the avatar it is cut from, so a
// translating avatar would carry its bite off the neighbour mid-flight -
// content-side motion is what the follow detectors deliberately don't watch.
const StackAvatar = ({
  index,
  visible = true,
  ref,
}: {
  index: number;
  visible?: boolean;
  ref?: Ref<HTMLDivElement>;
}) => (
  <Avatar
    ref={ref}
    face={FACES[index]}
    className="relative shrink-0 text-lg"
    style={{
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      marginLeft: index === 0 ? 0 : STACK_STEP - AVATAR_SIZE,
      zIndex: FACES.length - index,
      opacity: visible ? 1 : 0,
      transition: "opacity 0.45s ease",
    }}
  />
);

const GapScene = ({ progress, range }: SceneProps) => {
  const [gap, setGap] = useState(6);
  // The stack builds as you scroll: each zone crossing lands one more
  // avatar, arriving with its bite already cut by the neighbour before it.
  const [visibleCount, setVisibleCount] = useState(1);
  useScrollCycle(progress, range, FACES.length, (zone) => setVisibleCount(zone + 1));
  return (
    <div className="grid items-center gap-10 sm:grid-cols-[auto_1fr]">
      {/* Each avatar is overlapped by — and therefore cut by — the one to its
          left. The first sits on top and cuts nobody. */}
      <div className="flex justify-self-center">
        {FACES.map((face, i) =>
          i === 0 ? (
            <StackAvatar key={face.src ?? face.initials} index={i} />
          ) : (
            <Cutout
              key={face.src ?? face.initials}
              gap={gap}
              overlay={
                // A geometric stand-in for the left neighbour, not a second
                // copy of it: the mask only reads the silhouette, and the real
                // avatar paints itself in flow right on top of this.
                <span
                  className="absolute top-0 rounded-full opacity-0"
                  style={{
                    left: -STACK_STEP,
                    width: AVATAR_SIZE,
                    height: AVATAR_SIZE,
                  }}
                />
              }
            >
              <StackAvatar index={i} visible={i < visibleCount} />
            </Cutout>
          ),
        )}
      </div>
      {/* Single column below sm: the copy centres under the stack instead of
          hanging off its left edge. */}
      <div className="flex flex-col items-center gap-4 text-center sm:items-start sm:text-left">
        <SceneTitle
          title="gap"
          blurb="How far the cut is pushed out past the overlay's silhouette, in rendered pixels. Options are read live — drag and every mask recomputes."
        />
        <label className="chip flex w-fit items-center gap-2">
          <span className="min-w-14 font-mono tabular-nums">gap: {gap}px</span>
          <input
            type="range"
            min={0}
            max={16}
            value={gap}
            onChange={(e) => setGap(Number(e.target.value))}
          />
        </label>
        <Code>{`createCutout(avatar, nextAvatar, { gap: ${gap} })`}</Code>
      </div>
    </div>
  );
};

/* Scene 3 — contour tracing, mirrored split. Scroll cycles the glyph; the
   picker buttons override until the next zone boundary. */
const GLYPHS = {
  zap: {
    label: "zap",
    node: (
      <Zap
        size={48}
        className="absolute top-1.5 right-1.5 fill-base-content stroke-base-content"
        strokeWidth={1.5}
      />
    ),
  },
  star: {
    label: "star",
    node: (
      <Star
        size={48}
        className="absolute top-1.5 right-1.5 fill-base-content stroke-base-content"
        strokeWidth={1.5}
      />
    ),
  },
  flame: {
    label: "flame",
    node: (
      <Flame
        size={48}
        className="absolute top-1.5 right-1.5 fill-base-content stroke-base-content"
        strokeWidth={1.5}
      />
    ),
  },
} as const;

const GLYPH_KEYS = Object.keys(GLYPHS) as Array<keyof typeof GLYPHS>;

const ContourScene = ({ progress, range }: SceneProps) => {
  const [glyph, setGlyph] = useState<keyof typeof GLYPHS>("zap");
  useScrollCycle(progress, range, GLYPH_KEYS.length, (zone) => setGlyph(GLYPH_KEYS[zone]));
  return (
    <div className="grid items-center gap-10 sm:grid-cols-[1fr_auto]">
      <div className="order-2 flex flex-col items-center gap-4 text-center sm:order-1 sm:items-start sm:text-left">
        <SceneTitle
          title="Contours, not boxes"
          blurb="SVG overlays are traced glyph-for-glyph via stroke expansion — concave outlines, disjoint shapes, stroke widths compensated. shape: 'auto' picks it whenever the overlay contains an svg."
        />
        <div className="flex gap-2">
          {(Object.keys(GLYPHS) as Array<keyof typeof GLYPHS>).map((key) => (
            <button
              key={key}
              type="button"
              className={key === glyph ? chipActive : chip}
              onClick={() => setGlyph(key)}
            >
              {GLYPHS[key].label}
            </button>
          ))}
        </div>
        <Code>{'{ shape: "contour" } // auto for svg overlays'}</Code>
      </div>
      <div className="order-1 justify-self-center sm:order-2">
        <Cutout gap={5} overlay={GLYPHS[glyph].node}>
          <Bell size={128} className="fill-base-content stroke-base-content" strokeWidth={1.25} />
        </Cutout>
      </div>
    </div>
  );
};

/* Scene 4 — text glyphs, scissors mid-cut, gap slider. */
const TextScene = () => {
  const [gap, setGap] = useState(4);
  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <Cutout
        gap={gap}
        overlay={
          // Sized in em against a font-size-matched wrapper: the overlay
          // layer is a sibling of the wordmark, so em units would otherwise
          // resolve against the page font, not the 5xl glyphs.
          <span className="absolute inset-0 text-5xl sm:text-6xl" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              className="stroke-base-content absolute -top-[0.01em] left-[31%] h-[0.8em] w-[0.8em] overflow-visible fill-none"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Rotation lives INSIDE the svg so the mask copy rotates with
                  the pixels — a CSS transform would desync them. */}
              <g transform="rotate(30 12 12)">
                <circle cx="6" cy="6" r="3" />
                <path d="M8.12 8.12 12 12" />
                <path d="M20 4 8.12 15.88" />
                <circle cx="6" cy="18" r="3" />
                <path d="M14.8 14.8 20 20" />
              </g>
            </svg>
          </span>
        }
      >
        <span className="text-base-content text-5xl font-semibold tracking-tight sm:text-6xl">
          dom-cutout
        </span>
      </Cutout>
      <SceneTitle
        title="Text is fair game"
        blurb="Glyphs are just painted pixels to a mask — the scissors carve straight through the wordmark, and the gap stays adjustable."
      />
      <label className="chip flex w-fit items-center gap-2">
        <span className="min-w-14 font-mono tabular-nums">gap: {gap}px</span>
        <input
          type="range"
          min={0}
          max={8}
          value={gap}
          onChange={(e) => setGap(Number(e.target.value))}
        />
      </label>
      <Code>{`createCutout(wordmark, scissors, { gap: ${gap} })`}</Code>
    </div>
  );
};

/* Scene 5 — box shape + border-radius: red pill or blue pill. Scroll
   cycles the radius; the chips override until the next zone boundary. */
const RADII = [
  { label: "rounded-full", value: "calc(infinity * 1px)" },
  { label: "8px", value: "8px" },
  { label: "50%", value: "50%" },
  { label: "0", value: "0" },
] as const;

// lucide "hand-helping" paths (ISC); the left hand mirrors INSIDE the svg
// so the mask copy mirrors with the pixels — a CSS transform would desync.
const HAND_PATHS = (
  <>
    <path d="M11 12h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 14" />
    <path d="m7 18 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" />
    <path d="m2 13 6 6" />
  </>
);

const OfferedPill = ({
  mirrored,
  color,
  radius,
}: {
  mirrored?: boolean;
  color: string;
  radius: string;
}) => (
  <Cutout
    gap={4}
    overlay={
      <span
        className={`absolute h-7 w-14 ${color}`}
        style={{ borderRadius: radius, left: mirrored ? 30 : 42, top: 16 }}
      />
    }
  >
    <svg
      viewBox="0 0 24 24"
      className="stroke-base-content h-32 w-32 fill-none"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {mirrored ? <g transform="scale(-1 1) translate(-24 0)">{HAND_PATHS}</g> : HAND_PATHS}
    </svg>
  </Cutout>
);

const RadiusScene = ({ progress, range }: SceneProps) => {
  const [radius, setRadius] = useState<(typeof RADII)[number]>(RADII[0]);
  useScrollCycle(progress, range, RADII.length, (zone) => setRadius(RADII[zone]));
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex items-end gap-6 sm:gap-14">
        <OfferedPill
          mirrored
          color="bg-linear-to-b from-red-500 to-red-700"
          radius={radius.value}
        />
        <OfferedPill color="bg-linear-to-b from-blue-500 to-blue-700" radius={radius.value} />
      </div>
      <SceneTitle
        title="Box shape reads border-radius"
        blurb="Red or blue, the cutout follows each pill's computed corners — rounded-full stays a pill, 0 is just a box. You take the border-radius, the mask shows you how deep it goes."
      />
      <div className="flex flex-wrap justify-center gap-2">
        {RADII.map((r) => (
          <button
            key={r.label}
            type="button"
            className={r.label === radius.label ? chipActive : chip}
            onClick={() => setRadius(r)}
          >
            {r.label}
          </button>
        ))}
      </div>
      <Code>{`border-radius: ${radius.value}`}</Code>
    </div>
  );
};

/* Scene 6 — live sync, caption above, size slider. */
const LiveScene = () => {
  const [size, setSize] = useState(28);
  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <SceneTitle
        title="Always in sync"
        blurb="The mask is remeasured on re-renders and size changes — grow the badge and the halo follows. No pre-baked masks, no fixed shapes."
      />
      <Cutout
        gap={5}
        overlay={
          <span
            className="absolute right-0 bottom-0 block rounded-full bg-rose-500"
            style={{ width: size, height: size }}
          />
        }
      >
        <Avatar face={FACES[3]} />
      </Cutout>
      <label className="chip flex w-fit items-center gap-2">
        <span className="min-w-18 font-mono tabular-nums">badge: {size}px</span>
        <input
          type="range"
          min={12}
          max={44}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
        />
      </label>
      <Code>{"// ResizeObserver + re-renders keep it current"}</Code>
    </div>
  );
};

/* Per-scene background washes, enter/exit directions, and scroll spans.
   `span` is the scene's scroll length in viewport-heights (default 1) -
   scroll-scrubbed scenes take more so the scrub isn't over in a flick. */
const SCENES: Array<{
  component: (props: SceneProps) => ReactNode;
  wash: string;
  enter: { x?: number; y?: number };
  exit: { x?: number; y?: number };
  span?: number;
}> = [
  {
    component: CutScene,
    wash: "radial-gradient(55% 55% at 50% 35%, color-mix(in oklab, var(--color-primary) 12%, transparent), transparent 70%)",
    enter: { y: 40 },
    exit: { y: -28 },
    span: 2,
  },
  {
    component: GapScene,
    wash: "radial-gradient(60% 60% at 20% 50%, color-mix(in oklab, oklch(0.72 0.17 162) 12%, transparent), transparent 70%)",
    enter: { x: -56 },
    exit: { x: 56 },
    span: 3,
  },
  {
    component: ContourScene,
    wash: "radial-gradient(60% 60% at 80% 50%, color-mix(in oklab, oklch(0.8 0.16 86) 13%, transparent), transparent 70%)",
    enter: { x: 56 },
    exit: { x: -56 },
    span: 2.5,
  },
  {
    component: TextScene,
    wash: "radial-gradient(55% 55% at 50% 40%, color-mix(in oklab, var(--color-primary) 10%, transparent), transparent 72%)",
    enter: { y: -48 },
    exit: { y: 36 },
    span: 1.5,
  },
  {
    component: RadiusScene,
    wash: "radial-gradient(45% 55% at 32% 55%, color-mix(in oklab, oklch(0.63 0.21 25) 11%, transparent), transparent 70%), radial-gradient(45% 55% at 68% 55%, color-mix(in oklab, oklch(0.55 0.2 262) 12%, transparent), transparent 70%)",
    enter: { y: 56 },
    exit: { y: -40 },
    span: 3.5,
  },
  {
    component: LiveScene,
    wash: "radial-gradient(55% 55% at 50% 40%, color-mix(in oklab, oklch(0.65 0.2 12) 11%, transparent), transparent 70%)",
    enter: { y: 32 },
    exit: { y: -24 },
    span: 1.5,
  },
];

const TOTAL_SPAN = SCENES.reduce((sum, s) => sum + (s.span ?? 1), 0);
let cursor = 0;
const SCENE_RANGES = SCENES.map((s) => {
  const spanRange = [cursor / TOTAL_SPAN, (cursor + (s.span ?? 1)) / TOTAL_SPAN] as const;
  cursor += s.span ?? 1;
  return spanRange;
});

export const Tour = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState(0);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    const next = SCENE_RANGES.findIndex(([, end]) => progress < end);
    setScene(next === -1 ? SCENES.length - 1 : next);
  });

  const active = SCENES[scene];
  const ActiveScene = active.component;
  const motionProps = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0 },
      }
    : {
        initial: { opacity: 0, ...active.enter },
        animate: { opacity: 1, x: 0, y: 0 },
        exit: { opacity: 0, ...active.exit },
        transition: { duration: 0.35, ease: [0.22, 0.61, 0.36, 1] as const },
      };

  const jumpTo = (index: number) => {
    const container = containerRef.current;
    if (!container) return;
    const top = container.getBoundingClientRect().top + window.scrollY;
    // Progress runs over the container height MINUS one sticky viewport.
    const scrollable = (TOTAL_SPAN - 1) * window.innerHeight;
    window.scrollTo({
      top: top + SCENE_RANGES[index][0] * scrollable + 8,
      behavior: "smooth",
    });
  };

  return (
    <div ref={containerRef} style={{ height: `${TOTAL_SPAN * 100}vh` }}>
      <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden">
        <AnimatePresence>
          <m.div
            key={`wash-${scene}`}
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: active.wash }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.5 }}
          />
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <m.div key={scene} className="relative w-full max-w-2xl px-6" {...motionProps}>
            <ActiveScene progress={scrollYProgress} range={SCENE_RANGES[scene]} />
          </m.div>
        </AnimatePresence>

        <div className="absolute top-1/2 right-4 flex -translate-y-1/2 flex-col gap-2 sm:right-6">
          {SCENES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Scene ${i + 1}`}
              onClick={() => jumpTo(i)}
              className={`h-2 w-2 cursor-pointer rounded-full transition-colors ${
                i === scene ? "bg-primary" : "bg-base-content/20 hover:bg-base-content/40"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
