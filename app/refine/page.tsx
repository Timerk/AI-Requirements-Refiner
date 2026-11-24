import type { Metadata } from "next";
import { connection } from "next/server";
import { RefinerApp } from "@/components/RefinerApp";
import { publicAccess, readAccessConfig } from "@/lib/access/config";

export const metadata: Metadata = { title: "Refine an idea" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Read the deployment flags (for example DEMO_ONLY) per request, not at build time.
  await connection();
  const access = publicAccess(readAccessConfig());
  // The landing page links here with ?mode=live; ignore it where live runs are off.
  const liveSelectable = access.hostedLive || access.visitorKey;
  const initialMode =
    (await searchParams).mode === "live" && liveSelectable ? "live" : "demo";
  return <RefinerApp access={access} initialMode={initialMode} />;
}
