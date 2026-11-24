import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { BrandMark, brand } from "./_brand/mark";

export const alt =
  "Requirements Refiner: turn a rough idea into a specification you can build. Describe, clarify, specification.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const steps = ["Describe", "Clarify", "Specification"];

function Arrow() {
  return (
    <svg width="40" height="24" viewBox="0 0 40 24">
      <path
        d="M2 12h34M26 3l10 9-10 9"
        fill="none"
        stroke={brand.muted}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// The site's own fonts (OFL, see _brand/fonts/LICENSE-OFL.txt) are vendored
// so the image is rendered without any network font fetch.
const fontDir = join(process.cwd(), "app/_brand/fonts");

export default async function OpengraphImage() {
  const [grotesk, sans, sansMedium] = await Promise.all([
    readFile(join(fontDir, "space-grotesk-latin-500-normal.woff")),
    readFile(join(fontDir, "dm-sans-latin-400-normal.woff")),
    readFile(join(fontDir, "dm-sans-latin-500-normal.woff")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: brand.paper,
          color: brand.ink,
          fontFamily: "DM Sans",
          padding: "68px 80px",
          borderTop: `14px solid ${brand.green}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <BrandMark size={76} />
          <div
            style={{
              display: "flex",
              fontFamily: "Space Grotesk",
              fontSize: 40,
              letterSpacing: -1,
            }}
          >
            <span>requirements</span>
            <span style={{ color: brand.muted, marginLeft: 12 }}>
              / refiner
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Space Grotesk",
              fontWeight: 500,
              fontSize: 78,
              letterSpacing: -2,
              lineHeight: 1.1,
              maxWidth: 1000,
            }}
          >
            Turn a rough idea into a specification you can build.
          </div>
          <div style={{ display: "flex", fontSize: 30, color: brand.muted }}>
            AI analysis, an independent AI critique, and your decisions.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {steps.map((step, i) => (
            <div
              key={step}
              style={{ display: "flex", alignItems: "center", gap: 18 }}
            >
              {i > 0 ? <Arrow /> : null}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 26px 12px 14px",
                  borderRadius: 999,
                  fontSize: 30,
                  fontWeight: 500,
                  background: i === 2 ? brand.green : brand.mint,
                  color: i === 2 ? brand.paper : brand.ink,
                  border: `2px solid ${i === 2 ? brand.green : brand.line}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    fontSize: 22,
                    background: i === 2 ? brand.paper : brand.ink,
                    color: i === 2 ? brand.green : brand.paper,
                  }}
                >
                  {i + 1}
                </div>
                {step}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Space Grotesk", data: grotesk, weight: 500, style: "normal" },
        { name: "DM Sans", data: sans, weight: 400, style: "normal" },
        { name: "DM Sans", data: sansMedium, weight: 500, style: "normal" },
      ],
    },
  );
}
