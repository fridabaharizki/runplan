import {
    weekdays,
    type Feasibility,
    type PlanRequest,
    type PlanWeek,
    type PlannedSession,
    type SessionType,
    type TrainingPlan,
    type Weekday,
    type WeeklyTemplate,
    type WeekFocus,
} from "./schemas";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export const PLAN_CONFIG = {
    riegelExponent: 1.06,
    paces: { easyFactor: 1.2, intervalFactor: 0.95 },
    feasibility: { gainPerWeek: 0.006, maxGain: 0.2, onTrackShare: 0.5 },
    volume: {
        weeklyIncrease: 1.1,
        recoveryFactor: 0.75,
        taperFactor: 0.7,
        raceWeekFactor: 0.5,
        minWeeklyKm: 6,
        peakKmPerRaceKm: 2.5,
        longRunMaxRaceMultiple: 1.2,
        nearRaceRunMaxRaceShare: 0.5,
    },
    nearRaceDays: 6, // runs this close to race day are easy and short
    noStrengthDaysBeforeRace: 2,
    shortRunway: { weeks: 4 },
    recentEffort: { maxAgeDays: 42, minRaceShare: 0.5 },
} as const;

type RunRole = "long" | "quality" | "short";
type LayoutType = "rest" | "strength" | RunRole;
type Layout = Record<number, LayoutType>; // key = getUTCDay(): 0 = Sun ... 6 = Sat

const isRunRole = (type: SessionType): type is RunRole =>
    type === "long" || type === "quality" || type === "short";
const isHard = (type: LayoutType | undefined) => type === "long" || type === "quality";

const RUN_SHARE: Record<RunRole, number> = { long: 0.4, quality: 0.3, short: 0.2 };

const WEEKDAY_INDEX: Record<Weekday, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 };
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ROLE_NAMES: Record<LayoutType, string> = {
    long: "long run",
    quality: "quality run",
    short: "easy run",
    strength: "strength session",
    rest: "rest day",
};
const PREFERENCE_TO_TYPE = {
    rest: "rest",
    easy: "short",
    long: "long",
    quality: "quality",
    strength: "strength",
} as const satisfies Record<string, LayoutType>;

// Preferred days (getUTCDay) for each session when the template says "auto", best first.
const PLACEMENT_ORDER: Record<"long" | "quality" | "short" | "strength", number[]> = {
    long: [0, 6, 1, 5, 3, 4, 2], // Sun, Sat, Mon, Fri, Wed, Thu, Tue
    quality: [4, 2, 3, 5, 1, 6, 0], // Thu, Tue, Wed, Fri, Mon, Sat, Sun
    short: [2, 6, 1, 5, 3, 4, 0], // Tue, Sat, Mon, Fri, Wed, Thu, Sun
    strength: [1, 5, 3, 6, 4, 2, 0], // Mon, Fri, Wed, Sat, Thu, Tue, Sun
};
const BACK_TO_BACK_PENALTY = 10;
const STRENGTH_BEFORE_HARD_PENALTY = 2;

const toDateString = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const roundHalf = (km: number) => Math.max(1, Math.round(km * 2) / 2);
const round1 = (n: number) => Math.round(n * 10) / 10;
const mondayOf = (ms: number) => ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY_MS;
const dayOfWeek = (index: number) => ((index % 7) + 7) % 7;

const classify = (needed: number, weeks: number): Feasibility => {
    const { gainPerWeek, maxGain, onTrackShare } = PLAN_CONFIG.feasibility;
    const ceiling = Math.min(maxGain, weeks * gainPerWeek);
    if (needed <= ceiling * onTrackShare) return "on-track";
    if (needed <= ceiling) return "stretch";
    return "unrealistic";
};

type ResolvedLayout = { layout: Layout; fixedRuns: number; warnings: string[] };

// Turns "what you fixed" + "how many runs/strength you want" into a full week.
// Fixed days are kept as-is; the remaining sessions go on the best free days.
function resolveLayout(
    template: WeeklyTemplate | undefined,
    runsPerWeek: number,
    strengthDays: number,
): ResolvedLayout {
    const slots: Partial<Record<number, LayoutType>> = {};
    const warnings: string[] = [];

    for (const day of weekdays) {
        const preference = template?.[day] ?? "auto";
        if (preference !== "auto") slots[WEEKDAY_INDEX[day]] = PREFERENCE_TO_TYPE[preference];
    }

    const countFixed = (type: LayoutType) => Object.values(slots).filter((t) => t === type).length;
    const fixedRuns = countFixed("short") + countFixed("long") + countFixed("quality");
    const freeDays = () => [0, 1, 2, 3, 4, 5, 6].filter((day) => slots[day] === undefined);

    const place = (role: keyof typeof PLACEMENT_ORDER): boolean => {
        let best: { day: number; cost: number } | undefined;
        for (const day of freeDays()) {
            let cost = PLACEMENT_ORDER[role].indexOf(day);
            const before = slots[dayOfWeek(day - 1)];
            const after = slots[dayOfWeek(day + 1)];
            if ((role === "long" || role === "quality") && (isHard(before) || isHard(after))) {
                cost += BACK_TO_BACK_PENALTY;
            }
            if (role === "strength" && isHard(after)) cost += STRENGTH_BEFORE_HARD_PENALTY;
            if (!best || cost < best.cost) best = { day, cost };
        }
        if (!best) return false;
        slots[best.day] = role;
        return true;
    };

    // Missing runs, most important first: long, then quality, then easy runs
    const missingRuns = Math.max(0, runsPerWeek - fixedRuns);
    const roles: RunRole[] = [];
    if (countFixed("long") === 0) roles.push("long");
    if (countFixed("quality") === 0) roles.push("quality");
    while (roles.length < missingRuns) roles.push("short");

    const missingStrength = Math.max(0, strengthDays - countFixed("strength"));
    const wanted: (keyof typeof PLACEMENT_ORDER)[] = [
        ...roles.slice(0, missingRuns),
        ...Array.from({ length: missingStrength }, () => "strength" as const),
    ];
    if (wanted.some((role) => !place(role))) {
        warnings.push("Not enough open days to fit every session: some sessions were left out.");
    }

    const layout: Layout = {};
    for (let day = 0; day < 7; day++) layout[day] = slots[day] ?? "rest";

    for (let day = 0; day < 7; day++) {
        const today = layout[day];
        const tomorrow = layout[dayOfWeek(day + 1)];
        if (isHard(today) && isHard(tomorrow) && today && tomorrow) {
            warnings.push(
                `${DAY_NAMES[day]}'s ${ROLE_NAMES[today]} and ${DAY_NAMES[dayOfWeek(day + 1)]}'s ${ROLE_NAMES[tomorrow]} are back to back: consider moving one.`,
            );
        }
    }

    return { layout, fixedRuns, warnings };
}

type Targets = { focus: WeekFocus; km: number };

function planWeekTargets(weekCount: number, baseKm: number, raceKm: number): Targets[] {
    const v = PLAN_CONFIG.volume;
    const cap = Math.max(raceKm * v.peakKmPerRaceKm, baseKm);
    let loadKm = Math.max(baseKm, v.minWeeklyKm);
    const targets: Targets[] = [];

    for (let i = 0; i < weekCount; i++) {
        if (i === weekCount - 1) {
            targets.push({ focus: "race", km: loadKm * v.raceWeekFactor });
        } else if (i === weekCount - 2 && weekCount >= 3) {
            targets.push({ focus: "taper", km: loadKm * v.taperFactor });
        } else if ((i + 1) % 4 === 0) {
            targets.push({ focus: "recovery", km: loadKm * v.recoveryFactor });
        } else {
            loadKm = Math.min(loadKm * v.weeklyIncrease, cap);
            targets.push({ focus: "build", km: loadKm });
        }
    }
    return targets;
}

type WeekContext = {
    index: number;
    weekStartMs: number; // Monday
    startMs: number; // first day of the whole plan
    raceMs: number;
    raceKm: number;
    focus: WeekFocus;
    km: number;
    layout: Layout;
    fullShare: number; // sum of run shares in a complete week
    paces: TrainingPlan["summary"]["paces"];
};

const plannedFor = (ms: number, ctx: WeekContext): LayoutType =>
    ctx.layout[new Date(ms).getUTCDay()] ?? "rest";

function sessionTypeFor(ms: number, daysToRace: number, ctx: WeekContext): SessionType {
    if (daysToRace === 0) return "race";
    if (daysToRace === 1) return "rest";

    const planned = plannedFor(ms, ctx);
    if (isRunRole(planned)) return daysToRace <= PLAN_CONFIG.nearRaceDays ? "short" : planned;
    if (planned === "strength" && daysToRace <= PLAN_CONFIG.noStrengthDaysBeforeRace) return "rest";
    return planned;
}

function describeSession(ms: number, ctx: WeekContext): PlannedSession {
    const date = toDateString(ms);
    const daysToRace = Math.round((ctx.raceMs - ms) / DAY_MS);
    const type = sessionTypeFor(ms, daysToRace, ctx);
    const base = { id: date, date, type };

    if (type === "race") {
        return { ...base, targetKm: ctx.raceKm, paceSecPerKm: ctx.paces.race };
    }

    // The template said one thing, race-week rules changed it
    const planned = plannedFor(ms, ctx);
    const adjustedNote = planned !== "rest" && planned !== type ? { notes: "Adjusted for race week." } : {};

    if (type === "strength") {
        const next = sessionTypeFor(ms + DAY_MS, daysToRace - 1, ctx);
        return next === "long" || next === "quality"
            ? { ...base, notes: "Keep it light (core, upper body, mobility): a hard run is tomorrow." }
            : base;
    }
    if (!isRunRole(type)) return { ...base, ...adjustedNote };

    const v = PLAN_CONFIG.volume;
    let targetKm = roundHalf((ctx.km * RUN_SHARE[type]) / ctx.fullShare);
    if (type === "long") {
        targetKm = Math.min(targetKm, roundHalf(ctx.raceKm * v.longRunMaxRaceMultiple));
    }
    if (daysToRace <= PLAN_CONFIG.nearRaceDays) {
        targetKm = Math.min(targetKm, roundHalf(ctx.raceKm * v.nearRaceRunMaxRaceShare));
    }

    if (type === "quality") {
        const intervals = ctx.index % 2 === 0;
        return {
            ...base,
            targetKm,
            paceSecPerKm: intervals ? ctx.paces.interval : ctx.paces.race,
            notes: intervals
                ? "Warm up 10 min, 4 × 2 min at interval pace with 2 min easy jog, cool down."
                : "Warm up 10 min, 2–3 × 5 min at race pace with 2 min easy jog, cool down.",
        };
    }
    return { ...base, targetKm, paceSecPerKm: ctx.paces.easy, ...adjustedNote };
}

function buildWeek(ctx: WeekContext): PlanWeek {
    const sessions: PlannedSession[] = [];
    for (let d = 0; d < 7; d++) {
        const ms = ctx.weekStartMs + d * DAY_MS;
        if (ms < ctx.startMs) continue; // before the plan starts (first week)
        if (ms > ctx.raceMs) break; // after race day
        sessions.push(describeSession(ms, ctx));
    }

    return {
        weekStart: toDateString(ctx.weekStartMs),
        focus: ctx.focus,
        totalKm: round1(sessions.reduce((sum, s) => sum + (s.targetKm ?? 0), 0)),
        isPartial: sessions.length < 7,
        sessions,
    };
}

function recentEffortWarnings(request: PlanRequest, startMs: number): string[] {
    const { race, recentEffort } = request;
    const { maxAgeDays, minRaceShare } = PLAN_CONFIG.recentEffort;
    const warnings: string[] = [];

    if (!recentEffort.date) {
        warnings.push("No date for your recent run: use one from the last 4–6 weeks so the predicted time stays reliable.");
    } else {
        const ageDays = Math.round((startMs - Date.parse(recentEffort.date)) / DAY_MS);
        if (ageDays < 0) {
            warnings.push("Your recent run is dated after the plan's start date: check the date.");
        } else if (ageDays > maxAgeDays) {
            warnings.push(`Your recent run is ${Math.round(ageDays / 7)} weeks old: your predicted time may be out of date.`);
        }
    }
    if (recentEffort.distanceKm < race.distanceKm * minRaceShare) {
        warnings.push("Your recent run is short compared to the race distance: the predicted time is less reliable.");
    }
    return warnings;
}

// Pure function: `today` (the plan's start date) is injected so tests are deterministic.
export function generatePlan(request: PlanRequest, today: string): TrainingPlan {
    const { race, lastWeek, recentEffort, strengthDaysPerWeek } = request;
    const startMs = Date.parse(today);
    const raceMs = Date.parse(race.date);
    const daysToRace = Math.round((raceMs - startMs) / DAY_MS);

    // Riegel: project the recent effort to race distance
    const predictedTimeSec = Math.round(
        recentEffort.durationSec *
        (race.distanceKm / recentEffort.distanceKm) ** PLAN_CONFIG.riegelExponent,
    );
    const predictedPace = predictedTimeSec / race.distanceKm;
    const racePace = Math.round(race.targetTimeSec / race.distanceKm);
    const paces = {
        easy: Math.round(predictedPace * PLAN_CONFIG.paces.easyFactor),
        race: racePace,
        interval: Math.round(racePace * PLAN_CONFIG.paces.intervalFactor),
    };

    const weeksToRace = Math.max(0, Math.ceil(daysToRace / 7));
    const improvementNeeded = (predictedTimeSec - race.targetTimeSec) / predictedTimeSec;
    const summary = {
        weeksToRace,
        targetPaceSecPerKm: racePace,
        predictedTimeSec,
        feasibility: classify(improvementNeeded, weeksToRace),
        paces,
    };

    if (daysToRace < 0) {
        return { summary, weeks: [], warnings: ["The race date is before the start date."] };
    }

    const warnings: string[] = [];
    if (daysToRace < PLAN_CONFIG.shortRunway.weeks * 7) {
        warnings.push(`Only ${weeksToRace} week(s) to race day: this is sharpening, not building fitness.`);
    }
    if (lastWeek.runs === 0) warnings.push("No runs last week: assuming 3 runs per week.");
    if (lastWeek.runs > 4) warnings.push("Plans support up to 4 runs per week: capped at 4.");
    if (lastWeek.longestRunKm < race.distanceKm * 0.6) {
        warnings.push("Your longest run last week is well below race distance: keep the long run easy and build it gradually.");
    }
    if (summary.feasibility === "unrealistic") {
        warnings.push(
            `Target is about ${Math.round(improvementNeeded * 100)}% faster than your current predicted time: consider a more realistic target.`,
        );
    }
    warnings.push(...recentEffortWarnings(request, startMs));

    const runsPerWeek = Math.min(4, Math.max(2, lastWeek.runs || 3));
    const { layout, fixedRuns, warnings: layoutWarnings } = resolveLayout(
        request.template,
        runsPerWeek,
        strengthDaysPerWeek,
    );
    warnings.push(...layoutWarnings);
    if (fixedRuns > (lastWeek.runs || 3) + 1) {
        warnings.push(`Your template has ${fixedRuns} run days but you ran ${lastWeek.runs} last week: ramp up gradually.`);
    }

    const fullShare = Object.values(layout).reduce(
        (sum, type) => (isRunRole(type) ? sum + RUN_SHARE[type] : sum),
        0,
    );

    // Calendar weeks (Monday to Sunday), from the week containing the start date
    // to the week containing race day.
    const firstMonday = mondayOf(startMs);
    const weekCount = (mondayOf(raceMs) - firstMonday) / WEEK_MS + 1;
    const targets = planWeekTargets(weekCount, lastWeek.totalKm, race.distanceKm);

    const weeks = targets.map(({ focus, km }, index) =>
        buildWeek({
            index,
            weekStartMs: firstMonday + index * WEEK_MS,
            startMs,
            raceMs,
            raceKm: race.distanceKm,
            focus,
            km,
            layout,
            fullShare,
            paces,
        }),
    );

    return { summary, weeks, warnings };
}