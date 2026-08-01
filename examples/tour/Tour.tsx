import { Bell, Star, Zap } from "lucide-react";
import { AnimatePresence, m, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { type ReactNode, type Ref, useRef, useState } from "react";

import { Cutout } from "dom-cutout/react";

// Full-page scroll tour: the container spans one viewport-height per scene,
// a sticky stage pins to the screen, and scroll progress picks the scene.
// Every demo is the wrapperless <Cutout> from the package itself.
//
// Enter/exit animations are opacity + translate ONLY on anything containing
// a cutout: translation shifts content and overlay rects equally, so masks
// measured mid-animation stay correct — scale or rotation would skew them.

// ref-forwarding matters: <Cutout> masks its child by cloned ref, so a
// component that drops the ref silently never gets a mask.
const Avatar = ({
  className = "h-28 w-28 text-4xl",
  ref,
}: {
  className?: string;
  ref?: Ref<HTMLDivElement>;
}) => (
  <div
    ref={ref}
    className={`flex items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-violet-600 font-semibold text-white ${className}`}
  >
    MJ
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

/* Scene 1 — the cut itself, centered and huge. */
const CutScene = () => {
  const [shown, setShown] = useState(true);
  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <Cutout
        gap={5}
        overlay={
          shown && (
            <span className="absolute right-1 bottom-1 block h-9 w-9 rounded-full bg-emerald-500" />
          )
        }
      >
        <Avatar className="h-40 w-40 text-6xl" />
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

/* Scene 2 — gap, split layout, slider. */
const GapScene = () => {
  const [gap, setGap] = useState(6);
  return (
    <div className="grid items-center gap-10 sm:grid-cols-[auto_1fr]">
      <div className="justify-self-center">
        <Cutout
          gap={gap}
          overlay={
            <span className="absolute right-0.5 bottom-0.5 block h-7 w-7 rounded-full bg-emerald-500" />
          }
        >
          <Avatar />
        </Cutout>
      </div>
      <div className="flex flex-col gap-4">
        <SceneTitle
          title="gap"
          blurb="The halo width, in rendered pixels. Options are read live — drag and the mask recomputes."
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
        <Code>{`<Cutout gap={${gap}}>`}</Code>
      </div>
    </div>
  );
};

/* Scene 3 — contour tracing, mirrored split, glyph picker. */
const GLYPHS = {
  exclamation: {
    label: "!",
    node: (
      <svg
        viewBox="0 0 8 24"
        className="absolute -top-1 right-6 h-9 w-3 fill-red-500"
        aria-hidden="true"
      >
        <rect x="1.5" y="1" width="5" height="15" rx="2.5" />
        <circle cx="4" cy="21.5" r="2.5" />
      </svg>
    ),
  },
  star: {
    label: "star",
    node: (
      <Star
        size={38}
        className="absolute -right-1 -bottom-1 fill-amber-400 stroke-amber-800"
        strokeWidth={1.5}
      />
    ),
  },
  zap: {
    label: "zap",
    node: (
      <Zap
        size={38}
        className="absolute -right-2 top-0 fill-cyan-400 stroke-cyan-800"
        strokeWidth={1.5}
      />
    ),
  },
} as const;

const ContourScene = () => {
  const [glyph, setGlyph] = useState<keyof typeof GLYPHS>("exclamation");
  return (
    <div className="grid items-center gap-10 sm:grid-cols-[1fr_auto]">
      <div className="order-2 flex flex-col gap-4 sm:order-1">
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
          <Bell size={128} className="stroke-base-content" strokeWidth={1.25} />
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

/* Scene 5 — box shape + border-radius, wide card, radius chips. */
const RADII = [
  { label: "rounded-full", value: "calc(infinity * 1px)" },
  { label: "8px", value: "8px" },
  { label: "50%", value: "50%" },
  { label: "0", value: "0" },
] as const;

const RadiusScene = () => {
  const [radius, setRadius] = useState<(typeof RADII)[number]>(RADII[0]);
  return (
    <div className="flex flex-col items-center gap-8">
      <Cutout
        gap={5}
        overlay={
          <span
            className="absolute -top-3 right-6 bg-cyan-700 px-3 py-1.5 font-mono text-xs font-semibold text-white"
            style={{ borderRadius: radius.value }}
          >
            v0.3.0
          </span>
        }
      >
        <div className="h-28 w-72 rounded-2xl bg-linear-to-br from-slate-600 to-slate-900" />
      </Cutout>
      <SceneTitle
        title="Box shape reads border-radius"
        blurb="The bounding-box shape follows the overlay's computed corners — over-large radii resolve the way CSS does, so pills stay pills."
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
        <Avatar />
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

/* Per-scene background washes and enter/exit directions. */
const SCENES: Array<{
  component: () => ReactNode;
  wash: string;
  enter: { x?: number; y?: number };
  exit: { x?: number; y?: number };
}> = [
  {
    component: CutScene,
    wash: "radial-gradient(55% 55% at 50% 35%, color-mix(in oklab, var(--color-primary) 12%, transparent), transparent 70%)",
    enter: { y: 40 },
    exit: { y: -28 },
  },
  {
    component: GapScene,
    wash: "radial-gradient(60% 60% at 20% 50%, color-mix(in oklab, oklch(0.72 0.17 162) 12%, transparent), transparent 70%)",
    enter: { x: -56 },
    exit: { x: 56 },
  },
  {
    component: ContourScene,
    wash: "radial-gradient(60% 60% at 80% 50%, color-mix(in oklab, oklch(0.8 0.16 86) 13%, transparent), transparent 70%)",
    enter: { x: 56 },
    exit: { x: -56 },
  },
  {
    component: TextScene,
    wash: "radial-gradient(55% 55% at 50% 40%, color-mix(in oklab, var(--color-primary) 10%, transparent), transparent 72%)",
    enter: { y: -48 },
    exit: { y: 36 },
  },
  {
    component: RadiusScene,
    wash: "radial-gradient(55% 55% at 50% 65%, color-mix(in oklab, oklch(0.7 0.14 215) 13%, transparent), transparent 70%)",
    enter: { y: 56 },
    exit: { y: -40 },
  },
  {
    component: LiveScene,
    wash: "radial-gradient(55% 55% at 50% 40%, color-mix(in oklab, oklch(0.65 0.2 12) 11%, transparent), transparent 70%)",
    enter: { y: 32 },
    exit: { y: -24 },
  },
];

export const Tour = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState(0);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    setScene(Math.min(SCENES.length - 1, Math.max(0, Math.floor(progress * SCENES.length))));
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
    window.scrollTo({ top: top + index * window.innerHeight + 8, behavior: "smooth" });
  };

  return (
    <div ref={containerRef} style={{ height: `${SCENES.length * 100}vh` }}>
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
            <ActiveScene />
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
