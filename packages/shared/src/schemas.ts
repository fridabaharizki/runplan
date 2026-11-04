import { z } from "zod";

export const sessionTypes = ["short", "long", "quality", "strength", "rest", "race"] as const;
export const sessionTypeSchema = z.enum(sessionTypes);
export type SessionType = z.infer<typeof sessionTypeSchema>;

export const weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof weekdays)[number];

export const dayPreferences = ["auto", "rest", "easy", "long", "quality", "strength"] as const;
export const dayPreferenceSchema = z.enum(dayPreferences);
export type DayPreference = z.infer<typeof dayPreferenceSchema>;

const MAX_RUN_DAYS = 5;

// What you already know about your week. "auto" = let the generator decide.
export const weeklyTemplateSchema = z
    .object({
        mon: dayPreferenceSchema,
        tue: dayPreferenceSchema,
        wed: dayPreferenceSchema,
        thu: dayPreferenceSchema,
        fri: dayPreferenceSchema,
        sat: dayPreferenceSchema,
        sun: dayPreferenceSchema,
    })
    .superRefine((template, ctx) => {
        const prefs = weekdays.map((day) => template[day]);
        const count = (pref: DayPreference) => prefs.filter((p) => p === pref).length;
        const runDays = count("easy") + count("long") + count("quality");

        if (count("long") > 1) ctx.addIssue({ code: "custom", message: "Pick at most one long run day." });
        if (count("quality") > 1) ctx.addIssue({ code: "custom", message: "Pick at most one quality run day." });
        if (runDays > MAX_RUN_DAYS) {
            ctx.addIssue({ code: "custom", message: `Pick at most ${MAX_RUN_DAYS} run days.` });
        }
        if (prefs.every((p) => p !== "auto") && runDays === 0) {
            ctx.addIssue({
                code: "custom",
                message: "Your week has no run days: set at least one day to a run, or leave a day on Auto.",
            });
        }
    });
export type WeeklyTemplate = z.infer<typeof weeklyTemplateSchema>;

export const emptyTemplate: WeeklyTemplate = {
    mon: "auto", tue: "auto", wed: "auto", thu: "auto", fri: "auto", sat: "auto", sun: "auto",
};

export const planRequestSchema = z.object({
    // Local date (yyyy-mm-dd) the plan should start from. Defaults to the server's "today".
    startDate: z.iso.date().optional(),
    race: z.object({
        date: z.iso.date(),
        distanceKm: z.union([z.literal(5), z.literal(10)]),
        targetTimeSec: z.number().int().positive(),
    }),
    lastWeek: z.object({
        runs: z.number().int().min(0).max(7),
        totalKm: z.number().min(0).max(200),
        longestRunKm: z.number().min(0).max(42),
    }),
    // A recent hard-ish run, used to estimate current fitness
    recentEffort: z.object({
        distanceKm: z.number().positive().max(42),
        durationSec: z.number().int().positive(),
        date: z.iso.date().optional(), // when you ran it
    }),
    // Optional. Omit it (or leave every day on "auto") to let the generator choose.
    template: weeklyTemplateSchema.optional(),
    // Total strength days per week; days fixed to "strength" in the template count toward it.
    strengthDaysPerWeek: z.number().int().min(0).max(3).default(2),
});
export type PlanRequest = z.infer<typeof planRequestSchema>;

export type Feasibility = "on-track" | "stretch" | "unrealistic";
export type WeekFocus = "build" | "recovery" | "taper" | "race";

export type PlannedSession = {
    id: string;
    date: string; // yyyy-mm-dd
    type: SessionType;
    targetKm?: number;
    paceSecPerKm?: number;
    notes?: string;
};

export type PlanWeek = {
    weekStart: string; // the Monday of this calendar week
    focus: WeekFocus;
    totalKm: number;
    isPartial: boolean; // fewer than 7 days (first week, or race week ending on race day)
    sessions: PlannedSession[];
};

export type TrainingPlan = {
    summary: {
        weeksToRace: number;
        targetPaceSecPerKm: number;
        predictedTimeSec: number;
        feasibility: Feasibility;
        paces: { easy: number; race: number; interval: number }; // sec per km
    };
    weeks: PlanWeek[];
    warnings: string[];
};