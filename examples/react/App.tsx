import { Bell, Star, TriangleAlert } from "lucide-react";
import { type CSSProperties, type ReactNode, useState } from "react";

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
  warningFill: "#fbbf24", // amber-400
  warningStroke: "#92400e", // amber-800
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

// Fixed width + left alignment: state labels change length ("online" /
// "away", "3px" / "0 (plain overlap)"), and resizing buttons shift the
// whole card on every click.
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

const Section = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) => (
  <section style={{ marginBottom: 40 }}>
    <h2 style={{ margin: "0 0 4px", fontSize: 18, color: palette.text }}>{title}</h2>
    <p style={{ margin: "0 0 16px", color: palette.textMuted, fontSize: 14 }}>{description}</p>
    <div style={cardStyle}>{children}</div>
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
      <Cutout gap={withGap ? 3 : 0} overlay={showDot && <StatusDot online={online} />}>
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
          Gap: {withGap ? "3px" : "0 (plain overlap)"}
        </button>
      </Controls>
    </>
  );
};

// Lucide icons are stroke-based; the contour tracer both fills and strokes
// the overlay's paths, so give badge glyphs an explicit fill for a solid
// silhouette (and a readable resting look). Lucide glyphs also carry ~15%
// viewBox padding, so the badge sits further inward than the box suggests —
// these offsets center it on the bell's top-right shoulder.
const WarningBadge = () => (
  <TriangleAlert
    size={30}
    fill={palette.warningFill}
    stroke={palette.warningStroke}
    strokeWidth={1.75}
    style={{ position: "absolute", top: -3, right: 1 }}
  />
);

const BadgeDemo = () => {
  const [hasWarning, setHasWarning] = useState(true);

  return (
    <>
      <Cutout gap={3} overlay={hasWarning && <WarningBadge />}>
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

const ShapeComparisonDemo = () => {
  const [gap, setGap] = useState(3);

  return (
    <>
      {(["contour", "box"] as const).map((shape) => (
        <figure key={shape} style={{ margin: 0, textAlign: "center" }}>
          <Cutout gap={gap} shape={shape} overlay={<StarOverlay />}>
            <PhotoTile />
          </Cutout>
          <figcaption style={{ fontSize: 13, marginTop: 8, color: palette.textMuted }}>
            shape=&quot;{shape}&quot;
          </figcaption>
        </figure>
      ))}
      <label style={{ fontSize: 13, display: "flex", gap: 8, color: palette.text }}>
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
    <h1 style={{ fontSize: 24, marginBottom: 4, color: palette.text }}>dom-cutout</h1>
    <p style={{ color: palette.textMuted, marginBottom: 32 }}>
      Live examples running against the package source. The striped backdrop shows through wherever
      the overlay's silhouette is cut out.
    </p>

    <Section
      title="Avatar status dot"
      description="The classic: a status dot punching through the avatar. Toggling the dot off clears the mask (nullish overlay renders children unmasked)."
    >
      <AvatarStatusDemo />
    </Section>

    <Section
      title="Warning badge on an icon"
      description="A lucide TriangleAlert cut out of a Bell, contour-for-contour. shape='auto' picks contour tracing because the overlay contains an svg."
    >
      <BadgeDemo />
    </Section>

    <Section
      title="contour vs box"
      description="The same star overlay traced two ways. contour follows the glyph outline via stroke expansion; box uses the expanded bounding box with border-radius."
    >
      <ShapeComparisonDemo />
    </Section>
  </main>
);
