import type { GeneratePlanInput, PlannedSession, SessionType } from "./schemas";

const DAY_MS = 86_400_000;

// index = getUTCDay(): 0 = Sun ... 6 = Sat
const WEEKLY_PATTERN: SessionType[] = [
    "long", "strength", "short", "rest", "quality", "strength", "rest",
];

const targetKmFor = (type: SessionType, input: GeneratePlanInput): number | undefined => {
    switch (type) {
        case "race": return input.raceKm;
        case "long": return input.currentLongestKm;
        case "short": return 3;
        case "quality": return 4;
        default: return undefined;
    }
};

// Pure function: `today` is injected so tests are deterministic.
export function generatePlan(input: GeneratePlanInput, today: string): PlannedSession[] {
    const start = Date.parse(today);
    const end = Date.parse(input.raceDate);
    const sessions: PlannedSession[] = [];

    for (let t = start; t <= end; t += DAY_MS) {
        const date = new Date(t).toISOString().slice(0, 10);
        const type: SessionType =
            t === end ? "race" : (WEEKLY_PATTERN[new Date(t).getUTCDay()] ?? "rest");
        sessions.push({ id: date, date, type, targetKm: targetKmFor(type, input) });
    }
    return sessions;
}