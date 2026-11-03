import { describe, expect, it } from "vitest";
import { createApp } from "./app";

const app = createApp({ webOrigin: "http://localhost:5173", getToday: () => "2026-11-03" });

const post = (body: unknown) =>
    app.request("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

describe("GET /health", () => {
    it("returns ok", async () => {
        const res = await app.request("/health");
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ status: "ok" });
    });
});

describe("POST /api/plans", () => {
    const valid = { raceDate: "2026-11-22", raceKm: 5, runsPerWeek: 3, currentLongestKm: 5 };

    it("returns a plan ending on race day", async () => {
        const res = await post(valid);
        expect(res.status).toBe(200);
        expect((await res.json()).at(-1)).toMatchObject({ date: "2026-11-22", type: "race" });
    });

    it("rejects invalid input with 400", async () => {
        expect((await post({ ...valid, raceKm: 7 })).status).toBe(400);
    });
});