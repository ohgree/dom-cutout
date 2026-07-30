import { type CSSProperties, type ReactNode, useState } from "react";

import { Cutout } from "dom-cutout/react";

// Striped card background: the cutout gap reveals whatever is behind the
// content, so the backdrop must be busy enough for the gap to read clearly.
const cardStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 48,
  padding: "40px 32px",
  borderRadius: 12,
  background: "repeating-linear-gradient(45deg, #dcd6f7 0 12px, #c9e4de 12px 24px)",
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
    <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>{title}</h2>
    <p style={{ margin: "0 0 16px", color: "#555", fontSize: 14 }}>{description}</p>
    <div style={cardStyle}>{children}</div>
  </section>
);

const Avatar = () => (
  <div
    style={{
      width: 72,
      height: 72,
      borderRadius: "50%",
      background: "linear-gradient(135deg, #5b6ee1, #8850c8)",
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
      background: online ? "#3ba55c" : "#b0b4bc",
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
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button type="button" onClick={() => setOnline((v) => !v)}>
          Status: {online ? "online" : "away"}
        </button>
        <button type="button" onClick={() => setShowDot((v) => !v)}>
          Dot: {showDot ? "shown" : "hidden"}
        </button>
        <button type="button" onClick={() => setWithGap((v) => !v)}>
          Gap: {withGap ? "3px" : "0 (plain overlap)"}
        </button>
      </div>
    </>
  );
};

const BellIcon = () => (
  <svg viewBox="0 0 24 24" width={64} height={64} fill="#33415c">
    <path d="M12 2a7 7 0 0 0-7 7v3.3l-1.7 3.4a1 1 0 0 0 .9 1.4h15.6a1 1 0 0 0 .9-1.4L19 12.3V9a7 7 0 0 0-7-7Zm-2.5 16a2.5 2.5 0 0 0 5 0h-5Z" />
  </svg>
);

const ExclamationBadge = () => (
  <svg
    viewBox="0 0 24 24"
    width={28}
    height={28}
    style={{ position: "absolute", top: -6, right: -8 }}
    fill="#e0a100"
  >
    <path d="M12 3a2 2 0 0 1 2 2l-.6 8a1.4 1.4 0 0 1-2.8 0L10 5a2 2 0 0 1 2-2Zm0 14.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" />
  </svg>
);

const BadgeDemo = () => {
  const [hasWarning, setHasWarning] = useState(true);

  return (
    <>
      <Cutout gap={3} overlay={hasWarning && <ExclamationBadge />}>
        <BellIcon />
      </Cutout>
      <button type="button" onClick={() => setHasWarning((v) => !v)}>
        Warning: {hasWarning ? "on" : "off"}
      </button>
    </>
  );
};

const StarOverlay = () => (
  <svg
    viewBox="0 0 24 24"
    width={30}
    height={30}
    style={{ position: "absolute", bottom: -6, right: -6 }}
    fill="#d4a017"
  >
    <path d="m12 2 2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 16.9l-6.1 3.5 1.5-6.8L2.2 9l6.9-.7L12 2Z" />
  </svg>
);

const PhotoTile = () => (
  <div
    style={{
      width: 80,
      height: 80,
      borderRadius: 14,
      background: "linear-gradient(160deg, #ff9a76, #d4506e 60%, #7c3f8c)",
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
          <figcaption style={{ fontSize: 13, marginTop: 8, color: "#555" }}>
            shape=&quot;{shape}&quot;
          </figcaption>
        </figure>
      ))}
      <label style={{ fontSize: 13, display: "flex", gap: 8 }}>
        gap: {gap}px
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
    <h1 style={{ fontSize: 24, marginBottom: 4 }}>dom-cutout</h1>
    <p style={{ color: "#555", marginBottom: 32 }}>
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
      description="An SVG exclamation badge cut out of an SVG bell, contour-for-contour. shape='auto' picks contour tracing because the overlay contains an svg."
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
