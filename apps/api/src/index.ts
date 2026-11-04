import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { env } from "./env";

const app = createApp({ webOrigins: env.WEB_ORIGINS });

serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
    console.log(`API running on http://localhost:${port}`);
});