import { ImageResponse } from "next/og";
import { BrandMark } from "./_brand/mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS applies its own rounded mask, so the mark is drawn full-bleed.
export default function AppleIcon() {
  return new ImageResponse(<BrandMark size={180} radius={0} />, { ...size });
}
