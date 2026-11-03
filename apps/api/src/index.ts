import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { env } from "./env";

const app = createApp({ webOrigin: env.WEB_ORIGIN });

serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
    console.log(`API running on http://localhost:${port}`);
});