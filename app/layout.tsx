import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Requirements Refiner",
  description:
    "Turn a project idea into a reviewed specification, with your decisions at the center.",
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
