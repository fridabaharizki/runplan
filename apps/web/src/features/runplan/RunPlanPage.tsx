import { Link } from "@tanstack/react-router";
import { PlanForm } from "./PlanForm";
import { SummaryCard } from "./SummaryCard";
import { WeekList } from "./WeekList";
import { useGeneratePlan } from "./usePlan";

export function RunPlanPage() {
    const { generate, plan, isPending, error } = useGeneratePlan();

    return (
        <main className="mx-auto grid max-w-6xl gap-8 p-6 lg:grid-cols-[22rem_1fr]">
            <Link
                to="/"
                className="text-sm font-semibold text-(--accent-primary) hover:underline lg:col-span-2"
            >
                Back to portfolio
            </Link>
            <header className="lg:col-span-2">
                <h1 className="text-2xl font-bold">RunPlan 🏃‍♀️</h1>
                <p className="text-sm opacity-70">
                    Tell us your next race and last week's progress. Get a week-by-week training menu.
                </p>
            </header>
            <aside>
                <PlanForm onSubmit={generate} isPending={isPending} />
            </aside>
            <div className="grid content-start gap-6">
                {error && <p role="alert" className="text-sm text-red-600">Couldn't generate the plan: {error}</p>}
                {plan && (
                    <>
                        <SummaryCard plan={plan} />
                        <WeekList weeks={plan.weeks} />
                    </>
                )}
            </div>
        </main>
    );
}