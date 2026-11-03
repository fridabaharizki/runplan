import { describe, expect, it } from "vitest";
import { generatePlan } from "./generate-plan";

const input = { raceDate: "2026-11-22", raceKm: 5, runsPerWeek: 3, currentLongestKm: 5 } as const;

describe("generatePlan", () => {
    it("starts today with the weekday's session (Tue = short run)", () => {
        expect(generatePlan(input, "2026-11-03")[0]).toMatchObject({ date: "2026-11-03", type: "short" });
    });

    it("ends with the race on race day", () => {
        expect(generatePlan(input, "2026-11-03").at(-1)).toMatchObject({
            date: "2026-11-22",
            type: "race",
            targetKm: 5,
        });
    });

    it("returns an empty plan if the race date has passed", () => {
        expect(generatePlan(input, "2026-12-01")).toEqual([]);
    });
});