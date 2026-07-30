import { Bell, Star, TriangleAlert } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";

import { Cutout } from "dom-cutout/react";

// Palette: indigo/violet core, emerald for status, amber for warnings.
// The backdrop is the design-tool transparency checkerboard — the universal
// "see-through here" texture, which is exactly what the cutout gap is.
const palette = {
  checker: "#e5e7eb", // gray-200 squares on white
  avatarFrom: "#6366f1", // indigo-500
  avatarTo: "#7c3aed", // violet-600
  online: "#10b981", // emerald-500
  away: "#94a3b8", // slate-400
  icon: "#334155", // slate-700
  warningFill: "#fbbf24", // amber-400 (gold star)
  warningStroke: "#92400e", // amber-800
  signYellow: "#facc15", // yellow-400 (road-sign badge)
  signBlack: "#0f172a", // slate-900
  text: "#1e293b", // slate-800
  textMuted: "#64748b", // slate-500
};

const cardStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 48,
  padding: "40px 32px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: `repeating-conic-gradient(${palette.checker} 0% 25%, #ffffff 0% 50%) 0 0 / 16px 16px`,
};

// Fixed width + left alignment: state labels change length on click, and
// resizing buttons would shift the card layout.
const buttonStyle: CSSProperties = {
  font: "inherit",
  fontSize: 13,
  width: 184,
  textAlign: "left",
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "white",
  color: palette.text,
  cursor: "pointer",
};

// Shiki-highlighted snippet in the page's light theme. Falls back to a
// plain block until (or if) highlighting resolves; styling for `.shiki`
// lives in index.html so the theme's own background wins.
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
  <section style={{ marginBottom: 40 }}>
    <h2 style={{ margin: "0 0 4px", fontSize: 18, color: palette.text }}>{title}</h2>
    <p style={{ margin: "0 0 16px", color: palette.textMuted, fontSize: 14 }}>{description}</p>
    <div style={cardStyle}>{children}</div>
    {code && <CodeBlock code={code} />}
  </section>
);

const Controls = ({ children }: { children: ReactNode }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
);

const Avatar = () => (
  <div
    style={{
      width: 72,
      height: 72,
      borderRadius: "50%",
      background: `linear-gradient(135deg, ${palette.avatarFrom}, ${palette.avatarTo})`,
      color: "white",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 24,
      fontWeight: 600,
    }}
  >
    MJ
  </div>
);

const StatusDot = ({ online }: { online: boolean }) => (
  <div
    style={{
      position: "absolute",
      bottom: 2,
      right: 2,
      width: 16,
      height: 16,
      borderRadius: "50%",
      background: online ? palette.online : palette.away,
    }}
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
        <button style={buttonStyle} type="button" onClick={() => setOnline((v) => !v)}>
          Status: {online ? "online" : "away"}
        </button>
        <button style={buttonStyle} type="button" onClick={() => setShowDot((v) => !v)}>
          Dot: {showDot ? "shown" : "hidden"}
        </button>
        <button style={buttonStyle} type="button" onClick={() => setWithGap((v) => !v)}>
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
    fill={palette.signYellow}
    stroke={palette.signBlack}
    strokeWidth={1.75}
    style={{ position: "absolute", top: -3, right: 1 }}
  />
);

const BadgeDemo = () => {
  const [hasWarning, setHasWarning] = useState(true);

  return (
    <>
      <Cutout overlay={hasWarning && <WarningBadge />}>
        <Bell size={64} stroke={palette.icon} strokeWidth={1.5} />
      </Cutout>
      <button style={buttonStyle} type="button" onClick={() => setHasWarning((v) => !v)}>
        Warning: {hasWarning ? "on" : "off"}
      </button>
    </>
  );
};

const StarOverlay = () => (
  <Star
    size={30}
    fill={palette.warningFill}
    stroke={palette.warningStroke}
    strokeWidth={1.5}
    style={{ position: "absolute", bottom: -8, right: -8 }}
  />
);

const PhotoTile = () => (
  <div
    style={{
      width: 80,
      height: 80,
      borderRadius: 14,
      background: "linear-gradient(160deg, #fb7185, #c026d3 55%, #4f46e5)",
    }}
  />
);

// Solid chip behind bare text sitting on the checkerboard — small grey
// labels are illegible directly on the pattern.
const labelChipStyle: CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "4px 10px",
};

const ShapeComparisonDemo = () => {
  const [gap, setGap] = useState(4);

  return (
    <>
      {(["contour", "box"] as const).map((shape) => (
        <figure key={shape} style={{ margin: 0, textAlign: "center" }}>
          <Cutout gap={gap} shape={shape} overlay={<StarOverlay />}>
            <PhotoTile />
          </Cutout>
          <figcaption
            style={{
              ...labelChipStyle,
              display: "inline-block",
              fontSize: 13,
              marginTop: 10,
              color: palette.textMuted,
            }}
          >
            shape=&quot;{shape}&quot;
          </figcaption>
        </figure>
      ))}
      <label
        style={{
          ...labelChipStyle,
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: palette.text,
        }}
      >
        <span style={{ minWidth: 52, fontVariantNumeric: "tabular-nums" }}>gap: {gap}px</span>
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
  <main style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px" }}>
    <a href="/" style={{ fontSize: 13, color: palette.textMuted, textDecoration: "none" }}>
      &larr; examples
    </a>
    <h1 style={{ fontSize: 24, margin: "8px 0 4px", color: palette.text }}>
      &lt;Cutout /&gt; &mdash; React
    </h1>
    <p style={{ color: palette.textMuted, marginBottom: 32 }}>
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
