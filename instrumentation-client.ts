import { initBotId } from "botid/client/core";

// Attaches Vercel BotID challenge headers to the two pipeline routes. The server
// verifies them before any paid call (lib/access/server.ts). In `next dev` this is
// a no-op, and outside Vercel the server skips the check.
initBotId({
  protect: [
    { path: "/api/analyze", method: "POST" },
    { path: "/api/specification", method: "POST" },
  ],
});
