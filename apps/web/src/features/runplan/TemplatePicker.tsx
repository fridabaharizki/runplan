import {
    dayPreferences,
    emptyTemplate,
    weekdays,
    weeklyTemplateSchema,
    type DayPreference,
    type Weekday,
    type WeeklyTemplate,
} from "./schemas";

const dayLabel: Record<Weekday, string> = {
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday",
};

const preferenceLabel: Record<DayPreference, string> = {
    auto: "Auto",
    rest: "Rest",
    easy: "Easy / recovery run",
    long: "Long run",
    quality: "Quality run",
    strength: "Strength",
};

const presets: { label: string; template: WeeklyTemplate }[] = [
    { label: "All auto", template: emptyTemplate },
    { label: "Sunday long run", template: { ...emptyTemplate, sun: "long" } },
    { label: "Mon easy · Sat strength · Sun long", template: { ...emptyTemplate, mon: "easy", sat: "strength", sun: "long" } },
];

const isHard = (pref: DayPreference) => pref === "long" || pref === "quality";

function describeTemplate(template: WeeklyTemplate) {
    const prefs = weekdays.map((day) => template[day]);
    const count = (pref: DayPreference) => prefs.filter((p) => p === pref).length;
    const runs = count("easy") + count("long") + count("quality");
    return `Fixed: ${runs} run${runs === 1 ? "" : "s"}, ${count("strength")} strength, ${count("rest")} rest · ${count("auto")} days on auto`;
}

function templateHints(template: WeeklyTemplate): string[] {
    return weekdays.flatMap((day, i) => {
        const next = weekdays[(i + 1) % weekdays.length]!; // Sunday wraps to Monday
        const [today, tomorrow] = [template[day], template[next]];
        if (isHard(today) && isHard(tomorrow)) {
            return [`${dayLabel[day]} and ${dayLabel[next]} are both hard run days back to back.`];
        }
        if (today === "strength" && isHard(tomorrow)) {
            return [`${dayLabel[day]} strength comes before a hard run: it will be planned as a light session.`];
        }
        return [];
    });
}

type Props = { value: WeeklyTemplate; onChange: (template: WeeklyTemplate) => void };

export function TemplatePicker({ value, onChange }: Props) {
    const parsed = weeklyTemplateSchema.safeParse(value);
    const errors = parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
    const hints = templateHints(value);

    return (
        <fieldset className="grid gap-3 rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-900">Weekly template</legend>
            <p className="text-xs text-slate-500">
                Set the days you already know. Days left on Auto are filled in for you. The week before race
                day always follows race-week rules.
            </p>

            <div className="flex flex-wrap gap-2">
                {presets.map((preset) => (
                    <button
                        key={preset.label}
                        type="button"
                        onClick={() => onChange(preset.template)}
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >
                        {preset.label}
                    </button>
                ))}
            </div>

            <div className="grid gap-2">
                {weekdays.map((day) => (
                    <label key={day} className="grid grid-cols-[6.5rem_1fr] items-center gap-2 text-sm">
                        <span className="font-medium text-slate-700">{dayLabel[day]}</span>
                        <select
                            value={value[day]}
                            onChange={(event) => onChange({ ...value, [day]: event.target.value as DayPreference })}
                            className={`w-full rounded-md border px-2 py-1.5 text-sm ${value[day] === "auto" ? "border-slate-200 text-slate-500" : "border-indigo-300 text-slate-900"
                                }`}
                        >
                            {dayPreferences.map((pref) => (
                                <option key={pref} value={pref}>
                                    {preferenceLabel[pref]}
                                </option>
                            ))}
                        </select>
                    </label>
                ))}
            </div>

            <p className="text-xs text-slate-600">{describeTemplate(value)}</p>
            {errors.map((message) => (
                <p key={message} role="alert" className="text-xs text-red-600">{message}</p>
            ))}
            {hints.map((message) => (
                <p key={message} className="text-xs text-amber-700">⚠️ {message}</p>
            ))}
        </fieldset>
    );
}