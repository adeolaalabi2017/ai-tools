import { ImageResponse } from "next/og";
import { BRAND_MARK_PATHS } from "@/components/aitools/brand-mark";
import { TOOLS } from "@/lib/aitools/data";

/* ------------------------------------------------------------------ */
/*  Open Graph / social share card, rendered once at build time.       */
/*  Colours are the dark theme tokens from globals.css (satori cannot  */
/*  read CSS variables). Uses next/og's bundled Noto Sans.             */
/* ------------------------------------------------------------------ */

export const alt = "Open AI Stack: find your open-source AI stack";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const C = {
  base: "#0a0c0b",
  card: "#121714",
  line: "#232d27",
  ink: "#fafafa",
  mute: "#a1a1aa",
  faint: "#8a8a93",
  accent: "#4ade80",
};

const CATEGORIES = ["Chat", "Coding", "Images", "Voice", "Agents"];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: C.base,
          color: C.ink,
        }}
      >
        {/* wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg
            width="52"
            height="52"
            viewBox="0 0 24 24"
            fill="none"
            stroke={C.accent}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={BRAND_MARK_PATHS.top} fill={C.accent} />
            <path d={BRAND_MARK_PATHS.middle} />
            <path d={BRAND_MARK_PATHS.bottom} />
          </svg>
          <span style={{ fontSize: 34, letterSpacing: "-0.01em" }}>Open AI Stack</span>
        </div>

        {/* headline + tagline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 92,
              lineHeight: 1.04,
              letterSpacing: "-0.03em",
            }}
          >
            <span>Find your</span>
            <span
              style={{
                display: "flex",
                alignSelf: "flex-start",
                paddingBottom: 10,
                borderBottom: `6px solid ${C.accent}`,
              }}
            >
              open-source AI stack.
            </span>
          </div>
          <span style={{ marginTop: 36, fontSize: 34, color: C.mute }}>
            Open-source alternatives to the AI tools you use.
          </span>
        </div>

        {/* footer row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 28,
            borderTop: `2px solid ${C.line}`,
          }}
        >
          <div style={{ display: "flex", gap: 12 }}>
            {CATEGORIES.map((c) => (
              <span
                key={c}
                style={{
                  padding: "8px 20px",
                  borderRadius: 999,
                  border: `2px solid ${C.line}`,
                  background: C.card,
                  fontSize: 24,
                  color: C.mute,
                }}
              >
                {c}
              </span>
            ))}
          </div>
          <span style={{ flexShrink: 0, fontSize: 26, color: C.faint, whiteSpace: "nowrap" }}>
            {TOOLS.length} reviewed projects
          </span>
        </div>
      </div>
    ),
    size,
  );
}
