import type { Feasibility, TrainingPlan } from "./schemas";
import { formatDuration, formatPace } from "./lib/format";

const feasibilityStyle: Record<Feasibility, { label: string; className: string }> = {
    "on-track": { label: "On track", className: "bg-emerald-100 text-emerald-800" },
    stretch: { label: "Stretch goal", className: "bg-amber-100 text-amber-800" },
    unrealistic: { label: "Unrealistic", className: "bg-red-100 text-red-800" },
};

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="text-lg font-semibold text-slate-900">{value}</dd>
        </div>
    );
}

export function SummaryCard({ plan }: { plan: TrainingPlan }) {
    const { summary, warnings } = plan;
    const badge = feasibilityStyle[summary.feasibility];

    return (
        <section className="grid gap-4 rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">Your plan</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}>
                    {badge.label}
                </span>
            </div>

            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="Weeks to race" value={String(summary.weeksToRace)} />
                <Stat label="Predicted now" value={formatDuration(summary.predictedTimeSec)} />
                <Stat label="Target pace" value={formatPace(summary.targetPaceSecPerKm)} />
                <Stat label="Easy pace" value={formatPace(summary.paces.easy)} />
            </dl>

            {warnings.length > 0 && (
                <ul className="grid gap-1 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                    {warnings.map((warning) => (
                        <li key={warning}>⚠️ {warning}</li>
                    ))}
                </ul>
            )}
        </section>
    );
}