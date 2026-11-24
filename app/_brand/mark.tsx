// Brand mark ("r↗" in a rounded ink square) shared by the generated icon and
// social images. Mirrors app/icon.svg and the header logo in RefinerApp.
export const brand = {
  paper: "#f8f9f5",
  ink: "#202d29",
  muted: "#64716c",
  line: "#dce3dc",
  green: "#275d48",
  mint: "#eaf1e7",
  orange: "#a05229",
} as const;

export function BrandMark({
  size,
  radius = size / 4,
}: {
  size: number;
  radius?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="64" height="64" rx={(radius / size) * 64} fill={brand.ink} />
      <g
        fill="none"
        stroke={brand.paper}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 47V25M17 33c0-6 4.5-9 11-9" />
        <path d="M33 38 47 24M37 24h10v10" />
      </g>
    </svg>
  );
}
