import type { Prisma } from "@prisma/client";
import { caseSeeds } from "../../prisma/seed/cases";
import { conceptSeeds } from "../../prisma/seed/concepts";
import { friendSeeds, leagueBotSeeds, ownerSeed, STUDY_GROUP_NAME, type UserSeed } from "../../prisma/seed/users";
import { addDays, dayKey } from "@/lib/dates";
import type { Db } from "@/lib/db";
import { isHosted } from "@/lib/hosting";
import type { CaseSeed, ConceptSeed, TreeNodeInput } from "@/lib/types";

type Tx = Prisma.TransactionClient | Db;

function totalXp(seed: UserSeed) {
  return Object.values(seed.activity).reduce((a, b) => a + b, 0);
}

async function writeActivity(tx: Tx, userId: string, seed: UserSeed, now: Date) {
  for (const [daysAgo, xp] of Object.entries(seed.activity)) {
    await tx.dailyActivity.create({
      data: { userId, day: dayKey(addDays(now, -Number(daysAgo))), xp, activities: Math.max(1, Math.round(xp / 30)) },
    });
  }
}

async function createUser(tx: Tx, seed: UserSeed, now: Date) {
  const user = await tx.user.create({
    data: {
      username: seed.username,
      firstName: seed.firstName,
      lastName: seed.lastName,
      email: seed.email,
      isLeagueBot: Boolean(seed.isLeagueBot),
      xp: totalXp(seed),
    },
  });
  await writeActivity(tx, user.id, seed, now);
  return user;
}

export async function createConcept(tx: Tx, seed: ConceptSeed, order: number) {
  return tx.concept.create({
    data: {
      slug: seed.slug,
      title: seed.title,
      summary: seed.summary,
      icon: seed.icon,
      order,
      published: seed.published,
      explainers: { create: seed.explainers.map((e, i) => ({ title: e.title, body: e.body, order: i })) },
      questions: {
        create: seed.questions.map((q, i) => ({
          kind: q.kind,
          prompt: q.prompt,
          scenario: q.scenario ?? null,
          explanation: q.explanation,
          order: i,
          options: { create: q.options.map((o, j) => ({ text: o.text, isCorrect: o.isCorrect, order: j })) },
        })),
      },
    },
  });
}

/** Inserts tree rows parent-first and returns the key → id map. Siblings keep their input order. */
export async function writeTree(tx: Tx, caseId: string, nodes: TreeNodeInput[]) {
  const ids = new Map<string, string>();
  // Sibling order comes from input order, worked out up front: insertion runs in passes, and a
  // child listed before its parent is placed a pass later than siblings listed after the parent.
  const orderOf = new Map<string, number>();
  const siblingsSeen = new Map<string | null, number>();
  for (const node of nodes) {
    const order = siblingsSeen.get(node.parentKey) ?? 0;
    siblingsSeen.set(node.parentKey, order + 1);
    orderOf.set(node.key, order);
  }
  const pending = [...nodes];
  let guard = nodes.length + 1;
  while (pending.length && guard-- > 0) {
    for (let i = 0; i < pending.length; ) {
      const node = pending[i];
      if (node.parentKey !== null && !ids.has(node.parentKey)) {
        i++;
        continue;
      }
      const row = await tx.issueTreeNode.create({
        data: {
          caseId,
          parentId: node.parentKey === null ? null : ids.get(node.parentKey)!,
          key: node.key,
          label: node.label,
          isCorrectPath: node.isCorrectPath,
          status: node.status ?? "ACTIVE_BRANCH",
          formula: node.formula ?? null,
          order: orderOf.get(node.key)!,
        },
      });
      ids.set(node.key, row.id);
      pending.splice(i, 1);
    }
  }
  // A node whose parent key never resolves would silently vanish; the importer calls this directly (KTD11).
  if (pending.length) throw new Error(`Tree node "${pending[0].label}" points to a missing parent`);
  return ids;
}

export async function createCase(tx: Tx, seed: CaseSeed) {
  const items = [
    ...seed.facts.map((text, order) => ({ kind: "fact", text, order })),
    ...seed.hints.map((text, order) => ({ kind: "hint", text, order })),
    ...seed.recommendations.map((text, order) => ({ kind: "recommendation", text, order })),
    ...seed.observations.map((text, order) => ({ kind: "observation", text, order })),
  ];
  const created = await tx.case.create({
    data: {
      title: seed.title,
      caseType: seed.caseType,
      difficulty: seed.difficulty,
      problemStatement: seed.problemStatement,
      published: seed.published,
      items: { create: items },
      transcript: { create: seed.transcript.map((t, order) => ({ ...t, order })) },
    },
  });
  await writeTree(tx, created.id, seed.tree);
  return created;
}

/** Full seed into an empty database. Callers run it inside a transaction so a failure leaves nothing behind. */
export async function seedDatabase(db: Tx, now = new Date()) {
  const owner = await createUser(db, ownerSeed, now);
  const friends = [];
  for (const f of friendSeeds) friends.push(await createUser(db, f, now));
  for (const b of leagueBotSeeds) await createUser(db, b, now);

  for (const f of friends) {
    await db.friendship.createMany({
      data: [
        { userId: owner.id, friendId: f.id },
        { userId: f.id, friendId: owner.id },
      ],
    });
  }
  // Friends know each other too, so peer testers can invite one another.
  for (let i = 0; i < friends.length; i++)
    for (let j = 0; j < friends.length; j++)
      if (i !== j) await db.friendship.create({ data: { userId: friends[i].id, friendId: friends[j].id } });

  await db.studyGroup.create({
    data: {
      name: STUDY_GROUP_NAME,
      ownerId: owner.id,
      members: { create: [owner, ...friends].map((u) => ({ userId: u.id })) },
    },
  });

  for (const [i, c] of conceptSeeds.entries()) await createConcept(db, c, i);
  for (const c of caseSeeds) await createCase(db, c);
}

/**
 * Seed for a public site: the learning content only (concepts and every case).
 * No people (every account there is a real sign-in) and no friendships. Run it
 * inside a transaction, like seedDatabase.
 */
export async function seedContent(db: Tx) {
  for (const [i, c] of conceptSeeds.entries()) await createConcept(db, c, i);
  for (const c of caseSeeds) await createCase(db, c);
}

/** All seeded people (owner, friends, league members) by username. */
export function seedUserByUsername(username: string): UserSeed | undefined {
  return [ownerSeed, ...friendSeeds, ...leagueBotSeeds].find((u) => u.username === username);
}

/** Restores one user's progress to seed state (settings → Reset all my progress). */
export async function resetUserProgress(db: Db, userId: string, now = new Date()) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  // On a public site nobody is a seeded person, even if a real user picked a seeded handle.
  const seed = user.username && !isHosted() ? seedUserByUsername(user.username) : undefined;
  await db.$transaction(async (tx) => {
    await tx.questionMastery.deleteMany({ where: { userId } });
    await tx.answerEvent.deleteMany({ where: { userId } });
    await tx.lessonCompletion.deleteMany({ where: { userId } });
    await tx.dailyActivity.deleteMany({ where: { userId } });
    // My own results go; results I interviewed belong to my partner, so only detach me.
    await tx.caseResult.deleteMany({ where: { intervieweeId: userId } });
    await tx.caseResult.updateMany({ where: { interviewerId: userId }, data: { interviewerId: null } });
    await tx.user.update({ where: { id: userId }, data: { xp: seed ? totalXp(seed) : 0, gateMode: "auto" } });
    if (seed) await writeActivity(tx, userId, seed, now);
  });
}
