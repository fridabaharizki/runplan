import { z } from "zod";

export const sessionTypes = ["short", "long", "quality", "strength", "rest", "race"] as const;
export const sessionTypeSchema = z.enum(sessionTypes);
export type SessionType = z.infer<typeof sessionTypeSchema>;

export const generatePlanInputSchema = z.object({
    raceDate: z.iso.date(),
    raceKm: z.union([z.literal(5), z.literal(10)]),
    runsPerWeek: z.number().int().min(2).max(5),
    currentLongestKm: z.number().positive().max(42),
});
export type GeneratePlanInput = z.infer<typeof generatePlanInputSchema>;

export type PlannedSession = {
    id: string;
    date: string; // yyyy-mm-dd
    type: SessionType;
    targetKm?: number;
};