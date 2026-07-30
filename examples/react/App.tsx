import { Bell, Star, TriangleAlert } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { Cutout } from "dom-cutout/react";

// Colors reference Tailwind's default palette directly; shared surface
// styles (.chip, .demo-card, .bg-checker, .shiki) live in ../styles.css.

// Shiki-highlighted snippet in the page's light theme. Falls back to a
// plain block until (or if) highlighting resolves.
const CodeBlock = ({ code }: { code: string }) => {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Dynamic so the highlighter stays off the demos' critical path (and so
    // both example pages import shiki the same way — mixing a static and a
    // dynamic import of it across pages panics rolldown's chunking).
    import("shiki")
      .then(({ codeToHtml }) => codeToHtml(code, { lang: "tsx", theme: "github-light-default" }))
      .then((result) => {
        if (!cancelled) setHtml(result);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (html === null) {
    return (
      <pre className="shiki">
        <code>{code}</code>
      </pre>
    );
  }
  // Safe: the HTML is shiki's rendering of our own literal snippets.
  // eslint-disable-next-line react/no-danger
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
};

const Section = ({
  title,
  description,
  code,
  children,
}: {
  title: string;
  description: string;
  code?: string;
  children: ReactNode;
}) => (
  <section className="mb-10">
    <h2 className="mb-1 text-lg font-semibold text-slate-900">{title}</h2>
    <p className="mb-4 text-sm text-slate-500">{description}</p>
    <div className="demo-card">{children}</div>
    {code && <CodeBlock code={code} />}
  </section>
);

const Controls = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col gap-2">{children}</div>
);

// Fixed width + left alignment: state labels change length on click, and
// resizing buttons would shift the card layout.
const demoButtonClass = "chip w-46 cursor-pointer text-left";

const Avatar = () => (
  <div className="flex h-18 w-18 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl font-semibold text-white">
    MJ
  </div>
);

const StatusDot = ({ online }: { online: boolean }) => (
  <div
    className={`absolute right-0.5 bottom-0.5 h-4 w-4 rounded-full ${online ? "bg-emerald-500" : "bg-slate-400"}`}
  />
);

const AvatarStatusDemo = () => {
  const [online, setOnline] = useState(true);
  const [showDot, setShowDot] = useState(true);
  const [withGap, setWithGap] = useState(true);

  return (
    <>
      <Cutout gap={withGap ? 4 : 0} overlay={showDot && <StatusDot online={online} />}>
        <Avatar />
      </Cutout>
      <Controls>
        <button className={demoButtonClass} type="button" onClick={() => setOnline((v) => !v)}>
          Status: {online ? "online" : "away"}
        </button>
        <button className={demoButtonClass} type="button" onClick={() => setShowDot((v) => !v)}>
          Dot: {showDot ? "shown" : "hidden"}
        </button>
        <button className={demoButtonClass} type="button" onClick={() => setWithGap((v) => !v)}>
          Gap: {withGap ? "4px" : "0 (plain overlap)"}
        </button>
      </Controls>
    </>
  );
};

// Badge glyphs need an explicit fill: the mask removes content behind the
// whole silhouette, so a hollow (stroke-only) badge would show the backdrop
// through its interior. The offsets account for lucide's ~15% viewBox
// padding — naive negative offsets land in empty space.
const WarningBadge = () => (
  <TriangleAlert
    size={30}
    className="absolute -top-[3px] right-[1px] fill-yellow-400 stroke-slate-900"
    strokeWidth={1.75}
  />
);

const BadgeDemo = () => {
  const [hasWarning, setHasWarning] = useState(true);

  return (
    <>
      <Cutout overlay={hasWarning && <WarningBadge />}>
        <Bell size={64} className="stroke-slate-700" strokeWidth={1.5} />
      </Cutout>
      <button className={demoButtonClass} type="button" onClick={() => setHasWarning((v) => !v)}>
        Warning: {hasWarning ? "on" : "off"}
      </button>
    </>
  );
};

const StarOverlay = () => (
  <Star
    size={30}
    className="absolute -right-2 -bottom-2 fill-amber-400 stroke-amber-800"
    strokeWidth={1.5}
  />
);

const PhotoTile = () => (
  <div className="h-20 w-20 rounded-[14px] bg-gradient-to-br from-rose-400 via-fuchsia-600 to-indigo-600" />
);

const ShapeComparisonDemo = () => {
  const [gap, setGap] = useState(4);

  return (
    <>
      {(["contour", "box"] as const).map((shape) => (
        <figure key={shape} className="m-0 text-center">
          <Cutout gap={gap} shape={shape} overlay={<StarOverlay />}>
            <PhotoTile />
          </Cutout>
          <figcaption className="chip mt-2.5 inline-block text-slate-500">
            shape=&quot;{shape}&quot;
          </figcaption>
        </figure>
      ))}
      <label className="chip flex items-center gap-2">
        <span className="min-w-13 tabular-nums whitespace-nowrap">gap: {gap}px</span>
        <input
          type="range"
          min={0}
          max={8}
          value={gap}
          onChange={(e) => setGap(Number(e.target.value))}
        />
      </label>
    </>
  );
};

export const App = () => (
  <main className="mx-auto max-w-2xl px-5 py-10">
    <a href="../" className="text-[13px] text-slate-500 no-underline hover:text-slate-900">
      &larr; examples
    </a>
    <h1 className="mt-2 mb-1 text-2xl font-semibold text-slate-900">
      &lt;Cutout /&gt; &mdash; React
    </h1>
    <p className="mb-8 text-slate-500">
      The React adapter over the zero-dependency core: overlay and children as props, the mask kept
      in sync before every paint. The checkerboard shows through wherever a silhouette is cut out.
      View /react/App.tsx for the wiring.
    </p>

    <Section
      title="Avatar status dot"
      description="The classic: a status dot punching through the avatar. Toggling the dot off clears the mask (nullish overlay renders children unmasked)."
      code={`<Cutout gap={4} overlay={showDot && <StatusDot />}>
  <Avatar />
</Cutout>`}
    >
      <AvatarStatusDemo />
    </Section>

    <Section
      title="Warning badge on an icon"
      description="A lucide TriangleAlert cut out of a Bell, contour-for-contour. shape='auto' picks contour tracing because the overlay contains an svg."
      code={`<Cutout overlay={hasWarning && <TriangleAlert fill="#facc15" />}>
  <Bell />
</Cutout>`}
    >
      <BadgeDemo />
    </Section>

    <Section
      title="contour vs box"
      description="The same star overlay traced two ways. contour follows the glyph outline via stroke expansion; box uses the expanded bounding box with border-radius."
      code={`<Cutout shape="contour" gap={gap} overlay={<Star fill="gold" />}>
  <PhotoTile />
</Cutout>`}
    >
      <ShapeComparisonDemo />
    </Section>
  </main>
);
