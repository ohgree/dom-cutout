import { Bell, Star } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { Cutout } from "dom-cutout/react";

// Colors reference Tailwind's default palette directly; shared surface
// styles (.chip, .demo-card, .bg-checker, .shiki) live in ../styles.css.

// Strips the common leading indent, so snippet literals can be indented
// with the JSX they sit in instead of anchoring to column 0.
const dedent = (strings: TemplateStringsArray, ...values: unknown[]) => {
  const lines = String.raw(strings, ...values)
    .replace(/^\n/, "")
    .trimEnd()
    .split("\n");
  const indent = Math.min(
    ...lines.filter((line) => line.trim()).map((line) => /^ */.exec(line)![0].length),
  );
  return lines.map((line) => line.slice(indent)).join("\n");
};

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
      <div className="mt-3">
        <pre className="shiki">
          <code>{code}</code>
        </pre>
      </div>
    );
  }
  // Safe: the HTML is shiki's rendering of our own literal snippets.
  // eslint-disable-next-line react/no-danger
  return <div className="mt-3" dangerouslySetInnerHTML={{ __html: html }} />;
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
  <div className="flex h-18 w-18 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-violet-600 text-2xl font-semibold text-white">
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

// A bare exclamation mark: two DISJOINT shapes (bar + dot), so the halo
// visibly traces two separate contours — something a bounding box can't
// fake. Badge glyphs need an explicit fill: the mask removes content
// behind the whole silhouette.
const WarningBadge = () => (
  <svg
    viewBox="0 0 8 24"
    className="absolute -top-0.5 right-3 h-7 w-2.5 fill-red-500"
    aria-hidden="true"
  >
    <rect x="1.5" y="1" width="5" height="15" rx="2.5" />
    <circle cx="4" cy="21.5" r="2.5" />
  </svg>
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
  <div className="h-20 w-20 rounded-[14px] bg-linear-to-br from-rose-400 via-fuchsia-600 to-indigo-600" />
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
          <figcaption className="chip mx-auto mt-2.5 block w-fit text-slate-500">
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
  <main className="mx-auto max-w-2xl px-5 py-6">
    <a href="../" className="text-[13px] text-slate-500 no-underline hover:text-slate-900">
      &larr; examples
    </a>
    <h1 className="mt-2 mb-1 text-2xl font-semibold text-slate-900">
      &lt;Cutout /&gt; &mdash; React
    </h1>
    <p className="mb-8 text-slate-500">The React adapter over the zero-dependency core.</p>

    <Section
      title="Avatar status dot"
      description="The classic: a status dot punching through the avatar. Toggling the dot off clears the mask (nullish overlay renders children unmasked)."
      code={dedent`
        <Cutout gap={4} overlay={showDot && <StatusDot />}>
          <Avatar />
        </Cutout>
      `}
    >
      <AvatarStatusDemo />
    </Section>

    <Section
      title="Warning badge on an icon"
      description="An exclamation mark cut out of a Bell, contour-for-contour — two disjoint shapes, two traced halos. shape='auto' picks contour tracing because the overlay contains an svg."
      code={dedent`
        <Cutout overlay={hasWarning && <ExclamationMark />}>
          <Bell />
        </Cutout>
      `}
    >
      <BadgeDemo />
    </Section>

    <Section
      title="contour vs box"
      description="The same star overlay traced two ways. contour follows the glyph outline via stroke expansion; box uses the expanded bounding box with border-radius."
      code={dedent`
        <Cutout shape="contour" gap={gap} overlay={<Star fill="gold" />}>
          <PhotoTile />
        </Cutout>
      `}
    >
      <ShapeComparisonDemo />
    </Section>
  </main>
);
