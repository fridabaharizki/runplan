import { describe, expect, it } from "vitest";
import type { TrainingPlan } from "@runplan/shared";
import { createApp } from "./app";

const app = createApp({ webOrigins: ["http://localhost:5173"], getToday: () => "2026-11-03" });

const post = (body: unknown) =>
    app.request("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

const valid = {
    race: { date: "2026-11-22", distanceKm: 5, targetTimeSec: 1800 },
    lastWeek: { runs: 3, totalKm: 12, longestRunKm: 5 },
    recentEffort: { distanceKm: 5, durationSec: 1800 },
};

describe("GET /health", () => {
    it("returns ok", async () => {
        const res = await app.request("/health");
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ status: "ok" });
    });
});

describe("POST /api/plans", () => {
    it("returns a training plan ending on race day", async () => {
        const res = await post(valid);
        expect(res.status).toBe(200);
        const plan = (await res.json()) as TrainingPlan;
        expect(plan.summary.weeksToRace).toBe(3);
        expect(plan.weeks.at(-1)?.sessions.at(-1)).toMatchObject({ date: "2026-11-22", type: "race" });
    });

    it("rejects invalid input with 400", async () => {
        const res = await post({ ...valid, race: { ...valid.race, distanceKm: 7 } });
        expect(res.status).toBe(400);
    });

    it("falls back to the server date when startDate is missing", async () => {
        const plan = (await (await post(valid)).json()) as TrainingPlan;
        expect(plan.weeks[0]?.sessions[0]?.date).toBe("2026-11-03");
    });

    it("uses the client's startDate when provided", async () => {
        const plan = (await (await post({ ...valid, startDate: "2026-11-09" })).json()) as TrainingPlan;
        expect(plan.weeks[0]?.sessions[0]?.date).toBe("2026-11-09");
    });

    it("rejects a malformed startDate with 400", async () => {
        expect((await post({ ...valid, startDate: "09/11/2026" })).status).toBe(400);
    });
});

describe("POST /api/plans with a template", () => {
    it("accepts a weekly template and a dated recent run", async () => {
        const res = await post({
            ...valid,
            recentEffort: { ...valid.recentEffort, date: "2026-10-25" },
            template: { mon: "easy", tue: "auto", wed: "auto", thu: "auto", fri: "auto", sat: "strength", sun: "long" },
        });
        expect(res.status).toBe(200);
    });

    it("rejects a template with two long runs", async () => {
        const res = await post({
            ...valid,
            template: { mon: "auto", tue: "auto", wed: "auto", thu: "auto", fri: "auto", sat: "long", sun: "long" },
        });
        expect(res.status).toBe(400);
    });
});