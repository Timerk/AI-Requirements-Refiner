import { connection } from "next/server";
import { RefinerApp } from "@/components/RefinerApp";
import { publicAccess, readAccessConfig } from "@/lib/access/config";

export default async function Page() {
  // Read the deployment flags (for example DEMO_ONLY) per request, not at build time.
  await connection();
  return <RefinerApp access={publicAccess(readAccessConfig())} />;
}
