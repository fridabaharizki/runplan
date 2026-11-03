import { Hono } from "hono";
import { cors } from "hono/cors";
import { zValidator } from "@hono/zod-validator";
import { generatePlan, generatePlanInputSchema } from "@runplan/shared";

type AppConfig = {
    webOrigin: string;
    getToday?: () => string;
};

const isoToday = () => new Date().toISOString().slice(0, 10);

export const createApp = ({ webOrigin, getToday = isoToday }: AppConfig) =>
    new Hono()
        .use("/api/*", cors({ origin: webOrigin }))
        .get("/health", (c) => c.json({ status: "ok" }))
        .post("/api/plans", zValidator("json", generatePlanInputSchema), (c) =>
            c.json(generatePlan(c.req.valid("json"), getToday())),
        )
        .notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404))
        .onError((err, c) => {
            console.error(err);
            return c.json({ error: { code: "INTERNAL", message: "Something went wrong" } }, 500);
        });