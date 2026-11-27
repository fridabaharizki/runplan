import { useState, type FormEvent, type ReactNode } from "react";
import { planRequestSchema, type PlanRequest } from "./schemas";
import { addDays, formatDate, localDate, parseDuration } from "./lib/format";
import { TemplatePicker } from "./TemplatePicker";
import { useStoredTemplate } from "./useStoredTemplate";

type Props = { onSubmit: (request: PlanRequest) => void; isPending: boolean };

const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">{label}</span>
            {children}
        </label>
    );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
    return (
        <fieldset className="grid gap-3 rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-900">{title}</legend>
            {hint && <p className="text-xs text-slate-500">{hint}</p>}
            {children}
        </fieldset>
    );
}

export function PlanForm({ onSubmit, isPending }: Props) {
    const [error, setError] = useState<string | null>(null);
    const [startDate, setStartDate] = useState(localDate);
    const [template, setTemplate] = useStoredTemplate();

    const prefs = Object.values(template);
    const hasTemplate = prefs.some((pref) => pref !== "auto");
    const templateStrengthDays = prefs.filter((pref) => pref === "strength").length;

    // "Last week" = the 7 days before the plan starts
    const lastWeekRange = startDate
        ? `${formatDate(addDays(startDate, -7))} – ${formatDate(addDays(startDate, -1))}`
        : "the 7 days before your start date";

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const text = (name: string) => String(data.get(name) ?? "");
        const num = (name: string) => Number(text(name));

        const targetTimeSec = parseDuration(text("targetTime"));
        const durationSec = parseDuration(text("recentTime"));
        if (targetTimeSec === null || durationSec === null) {
            setError("Use time format h:mm:ss or mm:ss, e.g. 1:10:00 or 40:00.");
            return;
        }

        const recentDate = text("recentDate");
        const parsed = planRequestSchema.safeParse({
            startDate: text("startDate"),
            race: { date: text("raceDate"), distanceKm: num("raceDistance"), targetTimeSec },
            lastWeek: { runs: num("runs"), totalKm: num("totalKm"), longestRunKm: num("longestKm") },
            recentEffort: {
                distanceKm: num("recentKm"),
                durationSec,
                ...(recentDate ? { date: recentDate } : {}),
            },
            template: hasTemplate ? template : undefined,
            // With a template, its strength days are the strength days
            strengthDaysPerWeek: hasTemplate ? templateStrengthDays : num("strengthDays"),
        });
        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            setError(issue ? [issue.path.join("."), issue.message].filter(Boolean).join(": ") : "Please check your inputs.");
            return;
        }
        setError(null);
        onSubmit(parsed.data);
    };

    return (
        <form onSubmit={handleSubmit} className="grid gap-4">
            <Group title="Next race">
                <Field label="Race date">
                    <input name="raceDate" type="date" defaultValue="2027-06-14" required className={inputClass} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Distance">
                        <select name="raceDistance" defaultValue="10" className={inputClass}>
                            <option value="5">5K</option>
                            <option value="10">10K</option>
                        </select>
                    </Field>
                    <Field label="Target time (h:mm:ss)">
                        <input name="targetTime" defaultValue="1:10:00" required className={inputClass} />
                    </Field>
                </div>
                <Field label="Plan start date">
                    <input
                        name="startDate"
                        type="date"
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                        required
                        className={inputClass}
                    />
                </Field>
            </Group>

            <Group
                title={`Last week: ${lastWeekRange}`}
                hint="Use a typical week. If last week was a holiday, you were sick, or it included a race, use your last normal week."
            >
                <div className="grid grid-cols-3 gap-3">
                    <Field label="Runs">
                        <input name="runs" type="number" min={0} max={7} defaultValue={3} className={inputClass} />
                    </Field>
                    <Field label="Total km">
                        <input name="totalKm" type="number" min={0} step="0.1" defaultValue={10} className={inputClass} />
                    </Field>
                    <Field label="Longest km">
                        <input name="longestKm" type="number" min={0} step="0.1" defaultValue={5} className={inputClass} />
                    </Field>
                </div>
            </Group>

            <Group
                title="A recent hard-ish run"
                hint="From the last 4–6 weeks: a race or a steady, comfortably hard effort of about half your race distance or longer. Not an easy jog or an all-out sprint."
            >
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Distance (km)">
                        <input name="recentKm" type="number" min={1} step="0.1" defaultValue={5} className={inputClass} />
                    </Field>
                    <Field label="Time (mm:ss)">
                        <input name="recentTime" defaultValue="40:00" required className={inputClass} />
                    </Field>
                </div>
                <Field label="Date of the run (optional)">
                    <input name="recentDate" type="date" max={startDate || undefined} className={inputClass} />
                </Field>
            </Group>

            <TemplatePicker value={template} onChange={setTemplate} />

            {!hasTemplate && (
                <Field label="Strength days per week">
                    <select name="strengthDays" defaultValue="2" className={inputClass}>
                        {[0, 1, 2, 3].map((n) => (
                            <option key={n} value={n}>{n}</option>
                        ))}
                    </select>
                </Field>
            )}

            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

            <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
                {isPending ? "Generating…" : "Generate training menu"}
            </button>
        </form>
    );
}