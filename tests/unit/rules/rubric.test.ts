import { describe, expect, it } from "vitest";
import { averageScore, RUBRIC_CRITERIA, validateRubric } from "@/lib/rules/rubric";

describe("rubric", () => {
  it("has the six consulting criteria", () => {
    expect(RUBRIC_CRITERIA.map((c) => c.key)).toHaveLength(6);
  });

  it("averages scores", () => {
    expect(averageScore([5, 4, 4, 5, 4, 5])).toBeCloseTo(4.5);
  });

  it("requires every criterion scored 1–5 exactly once", () => {
    const full = RUBRIC_CRITERIA.map((c) => ({ criterion: c.key, score: 4, notes: "" }));
    expect(validateRubric(full)).toBeNull();
    expect(validateRubric(full.slice(0, 5))).toMatch(/every criterion/i);
    expect(validateRubric([...full.slice(0, 5), { ...full[5], score: 6 }])).toMatch(/1 to 5/);
  });
});
