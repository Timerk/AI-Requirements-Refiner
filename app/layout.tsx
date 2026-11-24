import type { Metadata } from "next";
import "./globals.css";

const siteName = "Requirements Refiner";
const description =
  "Turn a project idea into a reviewed specification, with your decisions at the center.";

// Icons and social images come from the file conventions in app/
// (icon.svg, apple-icon.tsx, opengraph-image.tsx, twitter-image.tsx).
export const metadata: Metadata = {
  metadataBase: new URL("https://ai-requirements-refiner.vercel.app"),
  title: {
    default: siteName,
    template: `%s · ${siteName}`,
  },
  description,
  applicationName: siteName,
  openGraph: {
    type: "website",
    siteName,
    title: siteName,
    description,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
