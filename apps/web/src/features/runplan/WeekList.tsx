import type { PlanWeek, SessionType, WeekFocus } from "./schemas";
import { formatDate, formatPace } from "./lib/format";

const focusStyle: Record<WeekFocus, { label: string; bar: string; badge: string }> = {
    build: { label: "Build", bar: "bg-indigo-500", badge: "bg-indigo-100 text-indigo-800" },
    recovery: { label: "Recovery", bar: "bg-sky-400", badge: "bg-sky-100 text-sky-800" },
    taper: { label: "Taper", bar: "bg-amber-400", badge: "bg-amber-100 text-amber-800" },
    race: { label: "Race week", bar: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-800" },
};

const typeLabel: Record<SessionType, string> = {
    short: "Easy run",
    long: "Long run",
    quality: "Quality run",
    strength: "Strength",
    rest: "Rest",
    race: "RACE DAY 🏁",
};

function VolumeBars({ weeks }: { weeks: PlanWeek[] }) {
    const maxKm = Math.max(...weeks.map((w) => w.totalKm), 1);
    return (
        <div className="grid gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Weekly volume (km)</h3>
            <div className="flex h-24 items-end gap-0.5">
                {weeks.map((week, i) => (
                    <div
                        key={week.weekStart}
                        title={`Week ${i + 1}: ${week.totalKm} km (${focusStyle[week.focus].label})`}
                        className={`flex-1 rounded-t ${focusStyle[week.focus].bar}`}
                        style={{ height: `${(week.totalKm / maxKm) * 100}%` }}
                    />
                ))}
            </div>
        </div>
    );
}

function WeekRow({ week, index }: { week: PlanWeek; index: number }) {
    const focus = focusStyle[week.focus];
    return (
        <details open={index === 0} className="rounded-lg border border-slate-200">
            <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="font-medium text-slate-900">
                    Week {index + 1} · {weekRange(week)}
                    {week.isPartial && <span className="ml-2 text-xs font-normal text-slate-500">(partial)</span>}
                </span>
                <span className="flex items-center gap-2">
                    <span className="text-slate-600">{week.totalKm} km</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${focus.badge}`}>
                        {focus.label}
                    </span>
                </span>
            </summary>
            <ul className="divide-y divide-slate-100 border-t border-slate-100 text-sm">
                {week.sessions.map((session) => (
                    <li
                        key={session.id}
                        className={`grid grid-cols-[6rem_1fr_auto] gap-2 px-4 py-2 ${session.type === "rest" ? "text-slate-400" : "text-slate-800"
                            }`}
                    >
                        <span>{formatDate(session.date)}</span>
                        <span>
                            {typeLabel[session.type]}
                            {session.notes && <span className="block text-xs text-slate-500">{session.notes}</span>}
                        </span>
                        <span className="text-right">
                            {session.targetKm !== undefined && `${session.targetKm} km`}
                            {session.paceSecPerKm !== undefined && (
                                <span className="block text-xs text-slate-500">{formatPace(session.paceSecPerKm)}</span>
                            )}
                        </span>
                    </li>
                ))}
            </ul>
        </details>
    );
}

function weekRange(week: PlanWeek): string {
    const first = week.sessions[0];
    const last = week.sessions.at(-1);
    if (!first || !last) return formatDate(week.weekStart);
    return first.date === last.date
        ? formatDate(first.date)
        : `${formatDate(first.date)} – ${formatDate(last.date)}`;
}

export function WeekList({ weeks }: { weeks: PlanWeek[] }) {
    if (weeks.length === 0) return null;
    return (
        <section className="grid gap-4">
            <VolumeBars weeks={weeks} />
            <div className="grid gap-2">
                {weeks.map((week, i) => (
                    <WeekRow key={week.weekStart} week={week} index={i} />
                ))}
            </div>
        </section>
    );
}