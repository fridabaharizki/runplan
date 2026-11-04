import { describe, expect, it } from "vitest";
import { emptyTemplate, weeklyTemplateSchema } from "./schemas";

const messages = (template: unknown) => {
    const result = weeklyTemplateSchema.safeParse(template);
    return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe("weeklyTemplateSchema", () => {
    it("accepts an all-auto template", () => {
        expect(messages(emptyTemplate)).toEqual([]);
    });

    it("accepts a realistic week", () => {
        expect(messages({ ...emptyTemplate, mon: "easy", sat: "strength", sun: "long" })).toEqual([]);
    });

    it("accepts five run days", () => {
        expect(messages({ ...emptyTemplate, mon: "easy", tue: "easy", wed: "easy", thu: "quality", fri: "easy" })).toEqual([]);
    });

    it("rejects two long run days", () => {
        expect(messages({ ...emptyTemplate, sat: "long", sun: "long" })).toEqual(["Pick at most one long run day."]);
    });

    it("rejects two quality run days", () => {
        expect(messages({ ...emptyTemplate, tue: "quality", thu: "quality" })).toEqual(["Pick at most one quality run day."]);
    });

    it("rejects more than five run days", () => {
        const six = { ...emptyTemplate, mon: "easy", tue: "easy", wed: "easy", thu: "easy", fri: "easy", sat: "easy" };
        expect(messages(six)).toEqual(["Pick at most 5 run days."]);
    });

    it("rejects a fully fixed week with no run", () => {
        const noRuns = { mon: "rest", tue: "rest", wed: "strength", thu: "rest", fri: "strength", sat: "rest", sun: "rest" };
        expect(messages(noRuns)).toHaveLength(1);
    });

    it("rejects unknown day preferences", () => {
        expect(weeklyTemplateSchema.safeParse({ ...emptyTemplate, mon: "yoga" }).success).toBe(false);
    });
});