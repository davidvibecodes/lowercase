import type { Db } from "@/lib/db";
import { selectLessonQuestions, shuffle } from "@/lib/rules/lesson";
import { getConceptHistory } from "./progress";

/** Builds one lesson: explainers + adaptive, randomized unmastered questions (R10, R13). */
export async function getLesson(db: Db, userId: string, slug: string, rng: () => number = Math.random) {
  const concept = await db.concept.findUnique({
    where: { slug },
    include: {
      explainers: { orderBy: { order: "asc" } },
      questions: { include: { options: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } },
    },
  });
  if (!concept) return null;
  const [mastery, history, user] = await Promise.all([
    db.questionMastery.findMany({ where: { userId, question: { conceptId: concept.id } }, select: { questionId: true } }),
    getConceptHistory(db, userId, concept.id),
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { soundOn: true, isAdmin: true } }),
  ]);
  if (!concept.published && !user.isAdmin) return null;
  const masteredIds = new Set(mastery.map((m) => m.questionId));
  const unmastered = concept.questions.filter((q) => !masteredIds.has(q.id));
  const { questions, mode, mastered } = selectLessonQuestions(unmastered, history, rng);

  return {
    concept: { id: concept.id, slug: concept.slug, title: concept.title, icon: concept.icon },
    explainers: concept.explainers.map((e) => ({ id: e.id, title: e.title, body: e.body })),
    questions: questions.map((q) => ({
      id: q.id,
      kind: q.kind,
      prompt: q.prompt,
      scenario: q.scenario,
      explanation: q.explanation,
      options: shuffle(q.options, rng).map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
    })),
    mode,
    mastered,
    totalQuestions: concept.questions.length,
    masteredCount: masteredIds.size,
    soundOn: user.soundOn,
  };
}

export async function resetConceptMastery(db: Db, userId: string, conceptId: string) {
  await db.questionMastery.deleteMany({ where: { userId, question: { conceptId } } });
}
