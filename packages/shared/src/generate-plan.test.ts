import { describe, expect, it } from "vitest";
import { generatePlan } from "./generate-plan";
import { emptyTemplate, type PlanRequest, type TrainingPlan } from "./schemas";

// Placeholder numbers: a 5K with a 30:00 target
const request: PlanRequest = {
    race: { date: "2026-11-22", distanceKm: 5, targetTimeSec: 1800 },
    lastWeek: { runs: 3, totalKm: 12, longestRunKm: 5 },
    recentEffort: { distanceKm: 5, durationSec: 1800 },
    strengthDaysPerWeek: 2,
};
const today = "2026-11-03"; // a Tuesday

const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

describe("generatePlan", () => {
    it("covers every day from the start date to race day", () => {
        const plan = generatePlan(request, today);
        const sessions = plan.weeks.flatMap((w) => w.sessions);
        expect(sessions[0]).toMatchObject({ date: "2026-11-03", type: "short" });
        expect(sessions.at(-1)).toMatchObject({ date: "2026-11-22", type: "race", targetKm: 5 });
        expect(sessions).toHaveLength(20);
        expect(plan.summary.weeksToRace).toBe(3);
    });

    it("rests the day before the race", () => {
        const sessions = generatePlan(request, today).weeks.flatMap((w) => w.sessions);
        expect(sessions.find((s) => s.date === "2026-11-21")?.type).toBe("rest");
    });

    it("classifies feasibility from predicted vs target time and weeks available", () => {
        const withTarget = (targetTimeSec: number) =>
            generatePlan({ ...request, race: { ...request.race, targetTimeSec } }, today).summary.feasibility;
        expect(withTarget(1800)).toBe("on-track");
        expect(withTarget(1780)).toBe("stretch");
        expect(withTarget(1500)).toBe("unrealistic");
    });

    it("adds a recovery week with lower volume in a longer plan", () => {
        const plan = generatePlan(
            { ...request, race: { date: "2027-01-10", distanceKm: 10, targetTimeSec: 3600 } },
            today,
        );
        expect(plan.weeks[3]?.focus).toBe("recovery");
        expect(plan.weeks[3]!.totalKm).toBeLessThan(plan.weeks[2]!.totalKm);
    });

    it("warns when there were no runs last week", () => {
        const plan = generatePlan({ ...request, lastWeek: { runs: 0, totalKm: 0, longestRunKm: 0 } }, today);
        expect(plan.warnings.join(" ")).toMatch(/No runs last week/);
    });

    it("returns no weeks if the race date has passed", () => {
        const plan = generatePlan(request, "2026-12-01");
        expect(plan.weeks).toEqual([]);
        expect(plan.warnings).toHaveLength(1);
    });
});

describe("calendar weeks (Monday to Sunday)", () => {
    const plan = generatePlan(request, today);

    it("starts every week after the first on a Monday", () => {
        plan.weeks.forEach((week, i) => {
            expect(weekdayOf(week.weekStart)).toBe(1);
            if (i > 0) expect(weekdayOf(week.sessions[0]!.date)).toBe(1);
        });
    });

    it("marks the first week as partial when starting mid-week", () => {
        expect(plan.weeks[0]).toMatchObject({ weekStart: "2026-11-02", isPartial: true });
        expect(plan.weeks[0]!.sessions[0]!.date).toBe("2026-11-03");
        expect(plan.weeks[1]!.isPartial).toBe(false);
    });

    it("scales a partial week instead of squeezing the volume into fewer days", () => {
        // Starting on Saturday leaves only Sat (rest) and Sun (long run) in week 1
        const sat = generatePlan(request, "2026-11-07");
        const week1 = sat.weeks[0]!;
        expect(week1.sessions.map((s) => s.type)).toEqual(["rest", "long"]);
        expect(week1.totalKm).toBeLessThan(plan.weeks[0]!.totalKm);
    });

    it("labels the last two weeks taper and race", () => {
        expect(plan.weeks.map((w) => w.focus)).toEqual(["build", "taper", "race"]);
    });

    it("supports a custom start date (e.g. after your 5K)", () => {
        const later = generatePlan(
            { ...request, race: { date: "2027-01-10", distanceKm: 10, targetTimeSec: 3600 } },
            "2026-11-23",
        );
        expect(later.weeks[0]!.sessions[0]!.date).toBe("2026-11-23");
        expect(later.weeks[0]!.isPartial).toBe(false); // 23 Nov 2026 is a Monday
    });
});

describe("10K on Monday 14 Jun 2027 (real case)", () => {
    const mine: PlanRequest = {
        race: { date: "2027-06-14", distanceKm: 10, targetTimeSec: 4200 },
        lastWeek: { runs: 3, totalKm: 10, longestRunKm: 5 },
        recentEffort: { distanceKm: 5, durationSec: 2400 },
        strengthDaysPerWeek: 2,
    };
    const plan = generatePlan(mine, "2026-11-03");
    const sessions = plan.weeks.flatMap((w) => w.sessions);

    it("is a stretch with 32 weeks to go", () => {
        expect(plan.summary).toMatchObject({ weeksToRace: 32, feasibility: "stretch", predictedTimeSec: 5004 });
    });

    it("never schedules a long run above 12 km", () => {
        const longs = sessions.filter((s) => s.type === "long").map((s) => s.targetKm ?? 0);
        expect(Math.max(...longs)).toBeLessThanOrEqual(12);
    });

    it("makes the race Monday its own one-day week, after a taper week", () => {
        const last = plan.weeks.at(-1)!;
        expect(last).toMatchObject({ weekStart: "2027-06-14", focus: "race", isPartial: true });
        expect(last.sessions).toEqual([expect.objectContaining({ date: "2027-06-14", type: "race", targetKm: 10 })]);
        expect(plan.weeks.at(-2)).toMatchObject({ weekStart: "2027-06-07", focus: "taper" });
    });

    it("keeps the last 6 days easy and short, with rest the day before", () => {
        const final = sessions.filter((s) => s.date >= "2027-06-08" && s.date < "2027-06-14");
        final.filter((s) => s.type === "short").forEach((s) => expect(s.targetKm).toBeLessThanOrEqual(5));
        expect(final.some((s) => s.type === "quality" || s.type === "long")).toBe(false);
        expect(sessions.find((s) => s.date === "2027-06-13")?.type).toBe("rest");
    });

    it("skips strength in the last 2 days before the race", () => {
        expect(sessions.filter((s) => s.date >= "2027-06-12" && s.type === "strength")).toEqual([]);
    });
});

// ------------------------

const weekTypes = (plan: TrainingPlan, weekIndex: number) =>
    plan.weeks[weekIndex]!.sessions.map((s) => s.type);

// Week index 1 of the 5K plan is a complete Mon–Sun week (9–15 Nov), clear of race-week rules
describe("weekly template", () => {
    it("behaves exactly like no template when every day is auto", () => {
        expect(generatePlan({ ...request, template: emptyTemplate }, today)).toEqual(generatePlan(request, today));
    });

    it("keeps your fixed days and fills the rest around them", () => {
        const plan = generatePlan(
            {
                ...request,
                strengthDaysPerWeek: 1, // the template already has one strength day
                template: { ...emptyTemplate, mon: "easy", sat: "strength", sun: "long" },
            },
            today,
        );
        expect(weekTypes(plan, 1)).toEqual(["short", "rest", "rest", "quality", "rest", "strength", "long"]);
    });

    it("makes strength light when a long run follows the next day", () => {
        const plan = generatePlan(
            { ...request, strengthDaysPerWeek: 1, template: { ...emptyTemplate, sat: "strength", sun: "long" } },
            today,
        );
        const saturday = plan.weeks[1]!.sessions.find((s) => s.type === "strength");
        expect(saturday?.notes).toMatch(/light/i);
    });

    it("places auto sessions away from a fixed hard day", () => {
        const plan = generatePlan({ ...request, template: { ...emptyTemplate, wed: "long" } }, today);
        const types = weekTypes(plan, 1); // Mon..Sun
        expect(types[2]).toBe("long");
        expect(types[1]).not.toBe("quality"); // Tue
        expect(types[3]).not.toBe("quality"); // Thu
        expect(types).toContain("quality");
    });

    it("warns when fixed hard days are back to back, including Sunday into Monday", () => {
        const plan = generatePlan(
            { ...request, template: { ...emptyTemplate, sun: "long", mon: "quality" } },
            today,
        );
        expect(plan.warnings.join(" ")).toMatch(/back to back/);
    });

    it("warns when the template has many more run days than last week", () => {
        const plan = generatePlan(
            { ...request, template: { ...emptyTemplate, mon: "easy", tue: "easy", wed: "easy", fri: "easy", sun: "long" } },
            today,
        );
        expect(plan.warnings.join(" ")).toMatch(/ramp up/);
    });

    it("lets race-week rules override the template and explains why", () => {
        const plan = generatePlan(
            {
                race: { date: "2027-06-14", distanceKm: 10, targetTimeSec: 4200 },
                lastWeek: { runs: 3, totalKm: 10, longestRunKm: 5 },
                recentEffort: { distanceKm: 5, durationSec: 2400 },
                strengthDaysPerWeek: 2,
                template: { ...emptyTemplate, sun: "long" },
            },
            "2026-11-03",
        );
        const sessions = plan.weeks.flatMap((w) => w.sessions);
        expect(sessions.find((s) => s.date === "2027-06-13")).toMatchObject({
            type: "rest",
            notes: expect.stringMatching(/race week/i),
        });
    });
});

describe("recent run checks", () => {
    const warningsFor = (recentEffort: PlanRequest["recentEffort"]) =>
        generatePlan({ ...request, recentEffort }, today).warnings.join(" ");

    it("asks for a date when it is missing", () => {
        expect(warningsFor({ distanceKm: 5, durationSec: 1800 })).toMatch(/No date/);
    });

    it("warns when the run is older than 6 weeks", () => {
        expect(warningsFor({ distanceKm: 5, durationSec: 1800, date: "2026-09-01" })).toMatch(/weeks old/);
    });

    it("accepts a recent dated run without a warning", () => {
        expect(warningsFor({ distanceKm: 5, durationSec: 1800, date: "2026-10-20" })).not.toMatch(/No date|weeks old|after the plan/);
    });

    it("warns when the run is dated after the start", () => {
        expect(warningsFor({ distanceKm: 5, durationSec: 1800, date: "2026-11-10" })).toMatch(/after the plan/);
    });

    it("warns when the run is much shorter than the race", () => {
        const plan = generatePlan(
            { ...request, race: { ...request.race, distanceKm: 10, targetTimeSec: 3600 }, recentEffort: { distanceKm: 3, durationSec: 1000, date: "2026-10-25" } },
            today,
        );
        expect(plan.warnings.join(" ")).toMatch(/short compared/);
    });
});