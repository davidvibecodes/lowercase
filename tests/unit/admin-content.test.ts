import { beforeEach, describe, expect, it } from "vitest";
import * as admin from "@/server/services/admin-content";
import { getConceptProgress } from "@/server/services/home";
import { getLesson } from "@/server/services/learn";
import { db, resetAndSeed, userId } from "./helpers/db";

const question = (correct: number[], options = 3) => ({
  kind: "concept",
  prompt: "Which box is a star?",
  scenario: null,
  explanation: "High growth, high share.",
  options: Array.from({ length: options }, (_, i) => ({ text: `Option ${i}`, isCorrect: correct.includes(i) })),
});

describe("admin content", () => {
  beforeEach(async () => {
    await resetAndSeed();
  });

  it("creates a published concept that appears last on the learner path and can be learned", async () => {
    const c = await admin.createConcept(db, { slug: "bcg-matrix", title: "BCG Matrix", summary: "Portfolio planning.", icon: "layers", published: true });
    await admin.saveExplainers(db, c.id, [
      { title: "Two axes", body: "Market growth vs **relative share**." },
      { title: "Four boxes", body: "- Stars\n- Cash cows\n- Question marks\n- Dogs" },
    ]);
    for (let i = 0; i < 3; i++) await admin.saveQuestion(db, c.id, null, question([0]));
    const roy = await userId("roy");
    const path = await getConceptProgress(db, roy);
    expect(path.at(-1)?.title).toBe("BCG Matrix");
    const lesson = await getLesson(db, roy, "bcg-matrix");
    expect(lesson?.explainers).toHaveLength(2);
    expect(lesson?.questions).toHaveLength(3);
  });

  it("rejects questions with zero or two correct options, or a single option", async () => {
    const c = await db.concept.findFirstOrThrow();
    await expect(admin.saveQuestion(db, c.id, null, question([]))).rejects.toThrow("Mark exactly one option as correct");
    await expect(admin.saveQuestion(db, c.id, null, question([0, 1]))).rejects.toThrow("Mark exactly one option as correct");
    await expect(admin.saveQuestion(db, c.id, null, question([0], 1))).rejects.toThrow("Add at least two options");
  });

  it("hides unpublished concepts from learners but keeps them in the admin list", async () => {
    const c = await db.concept.findFirstOrThrow({ where: { slug: "vrio" } });
    await admin.setConceptPublished(db, c.id, false);
    const roy = await userId("roy");
    expect((await getConceptProgress(db, roy)).some((x) => x.slug === "vrio")).toBe(false);
    expect(await getLesson(db, roy, "vrio")).toBeNull();
    expect((await admin.listConceptsAdmin(db)).some((x) => x.slug === "vrio")).toBe(true);
  });

  it("updates an explanation in place", async () => {
    const c = await db.concept.findFirstOrThrow({ include: { questions: { include: { options: true } } } });
    const q = c.questions[0];
    await admin.saveQuestion(db, c.id, q.id, {
      kind: q.kind,
      prompt: q.prompt,
      scenario: q.scenario,
      explanation: "A clearer explanation.",
      options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
    });
    expect((await db.question.findUniqueOrThrow({ where: { id: q.id } })).explanation).toBe("A clearer explanation.");
  });

  it("reorders concepts and deletes one with its content", async () => {
    const before = await admin.listConceptsAdmin(db);
    await admin.moveConcept(db, before[1].id, -1);
    const after = await admin.listConceptsAdmin(db);
    expect(after[0].id).toBe(before[1].id);
    await admin.deleteConcept(db, after[0].id);
    expect(await db.question.count({ where: { conceptId: after[0].id } })).toBe(0);
  });

  it("resets every learner's mastery on a concept", async () => {
    const c = await db.concept.findFirstOrThrow({ include: { questions: true } });
    await db.questionMastery.createMany({ data: [await userId("roy"), await userId("ankit")].map((u) => ({ userId: u, questionId: c.questions[0].id })) });
    expect(await admin.resetConceptMasteryForAll(db, c.id)).toBe(2);
  });
});
