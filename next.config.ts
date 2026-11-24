import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

const config: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  outputFileTracingIncludes: {
    "/api/*": ["./prompts/*.md"],
  },
};

// Adds the rewrites that proxy Vercel BotID's challenge scripts.
export default withBotId(config);
