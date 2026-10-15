import type { Db } from "@/lib/db";
import { conceptInput, explainerInput, questionInput } from "@/lib/types";
import { parseInput as parse, ServiceError } from "./invites";

export async function listConceptsAdmin(db: Db) {
  return db.concept.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { questions: true, explainers: true } } } });
}

export async function getConceptAdmin(db: Db, id: string) {
  return db.concept.findUnique({
    where: { id },
    include: {
      explainers: { orderBy: { order: "asc" } },
      questions: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } },
    },
  });
}

export async function createConcept(db: Db, input: unknown) {
  const data = parse(conceptInput, input);
  if (await db.concept.findUnique({ where: { slug: data.slug } })) throw new ServiceError("That slug is taken");
  const last = await db.concept.aggregate({ _max: { order: true } });
  return db.concept.create({ data: { ...data, order: (last._max.order ?? -1) + 1 } });
}

export async function updateConcept(db: Db, id: string, input: unknown) {
  const data = parse(conceptInput, input);
  const clash = await db.concept.findFirst({ where: { slug: data.slug, id: { not: id } } });
  if (clash) throw new ServiceError("That slug is taken");
  return db.concept.update({ where: { id }, data });
}

export async function moveConcept(db: Db, id: string, dir: -1 | 1) {
  const all = await db.concept.findMany({ orderBy: { order: "asc" }, select: { id: true } });
  const i = all.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  await db.$transaction(all.map((c, order) => db.concept.update({ where: { id: c.id }, data: { order } })));
}

export async function setConceptPublished(db: Db, id: string, published: boolean) {
  await db.concept.update({ where: { id }, data: { published } });
}

/** Deletes the concept with its explainers, questions and mastery (cascade). */
export async function deleteConcept(db: Db, id: string) {
  await db.concept.delete({ where: { id } });
}

/** Replaces the explainer list in the given order. */
export async function saveExplainers(db: Db, conceptId: string, list: unknown) {
  if (!Array.isArray(list)) throw new ServiceError("Invalid explainers");
  const items = list.map((e) => parse(explainerInput, e));
  await db.$transaction([
    db.explainerCard.deleteMany({ where: { conceptId } }),
    ...items.map((e, order) => db.explainerCard.create({ data: { conceptId, order, title: e.title, body: e.body } })),
  ]);
}

export async function saveQuestion(db: Db, conceptId: string, questionId: string | null, input: unknown) {
  const q = parse(questionInput, input);
  const fields = { kind: q.kind, prompt: q.prompt, scenario: q.scenario || null, explanation: q.explanation };
  const options = q.options.map((o, order) => ({ text: o.text, isCorrect: o.isCorrect, order }));
  if (questionId) {
    const existing = await db.question.findFirst({ where: { id: questionId, conceptId } });
    if (!existing) throw new ServiceError("Question not found");
    await db.$transaction([
      db.option.deleteMany({ where: { questionId } }),
      db.question.update({ where: { id: questionId }, data: { ...fields, options: { create: options } } }),
    ]);
    return questionId;
  }
  const last = await db.question.aggregate({ where: { conceptId }, _max: { order: true } });
  const created = await db.question.create({ data: { conceptId, ...fields, order: (last._max.order ?? -1) + 1, options: { create: options } } });
  return created.id;
}

export async function deleteQuestion(db: Db, questionId: string) {
  await db.question.delete({ where: { id: questionId } });
}

/** Admin reset: every learner's mastery on one concept (R12). */
export async function resetConceptMasteryForAll(db: Db, conceptId: string) {
  const r = await db.questionMastery.deleteMany({ where: { question: { conceptId } } });
  return r.count;
}
