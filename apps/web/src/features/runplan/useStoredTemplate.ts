import { useEffect, useState } from "react";
import { emptyTemplate, weeklyTemplateSchema, type WeeklyTemplate } from "./schemas";

const STORAGE_KEY = "runplan:template:v1";

function loadTemplate(): WeeklyTemplate {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = weeklyTemplateSchema.safeParse(raw ? JSON.parse(raw) : null);
        return parsed.success ? parsed.data : emptyTemplate; // never trust stored data
    } catch {
        return emptyTemplate; // storage unavailable or corrupted JSON
    }
}

// Remembers your weekly template in this browser (there are no accounts)
export function useStoredTemplate() {
    const [template, setTemplate] = useState<WeeklyTemplate>(loadTemplate);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(template));
        } catch {
            // storage unavailable (e.g. private mode): the template just won't persist
        }
    }, [template]);

    return [template, setTemplate] as const;
}