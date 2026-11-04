import { Hono } from "hono";
import { cors } from "hono/cors";
import { zValidator } from "@hono/zod-validator";
import { generatePlan, planRequestSchema } from "@runplan/shared";

type AppConfig = {
    webOrigins: string[];
    getToday?: () => string;
};

const isoToday = () => new Date().toISOString().slice(0, 10);

export const createApp = ({ webOrigins, getToday = isoToday }: AppConfig) =>
    new Hono()
        .use("/api/*", cors({ origin: webOrigins }))
        .get("/health", (c) => c.json({ status: "ok" }))
        .post("/api/plans", zValidator("json", planRequestSchema), (c) => {
            const body = c.req.valid("json");
            return c.json(generatePlan(body, body.startDate ?? getToday()));
        })
        .notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404))
        .onError((err, c) => {
            console.error(err);
            return c.json({ error: { code: "INTERNAL", message: "Something went wrong" } }, 500);
        });