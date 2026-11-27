import { useState } from "react";
import type { PlanRequest, TrainingPlan } from "./schemas";
import { api } from "./lib/api";

export function useGeneratePlan() {
    const [plan, setPlan] = useState<TrainingPlan | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPending, setIsPending] = useState(false);

    const generate = async (request: PlanRequest) => {
        setIsPending(true);
        setError(null);
        try {
            setPlan(
                await api<TrainingPlan>("/api/plans", { method: "POST", body: JSON.stringify(request) }),
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : "Something went wrong");
        } finally {
            setIsPending(false);
        }
    };

    return { generate, plan, error, isPending };
}