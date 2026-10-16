import { weekDayKeys } from "@/lib/dates";
import type { Db } from "@/lib/db";
import { gateMap } from "@/lib/rules/gates";
import { leagueDaysLeft, leagueStandings, standingsWindow, type LeagueMember } from "@/lib/rules/league";
import { CASE_TYPES, DIFFICULTIES } from "@/lib/types";
import { onboarded, personSelect, toPerson } from "./invites";
import { getGateResults, getUserProgress } from "./progress";

async function weeklyXpByUser(db: Db, userIds: string[], now: Date) {
  const rows = await db.dailyActivity.groupBy({
    by: ["userId"],
    where: { day: { in: weekDayKeys(now) }, userId: { in: userIds } },
    _sum: { xp: true },
  });
  return new Map(rows.map((r) => [r.userId, r._sum.xp ?? 0]));
}

function toMember(row: { id: string; username: string | null; firstName: string; lastName: string }, xp: Map<string, number>): LeagueMember {
  const u = toPerson(row);
  return { id: u.id, name: `${u.firstName} ${u.lastName}`, weeklyXp: xp.get(u.id) ?? 0 };
}

export async function getLeague(db: Db, userId: string, now = new Date()) {
  const me = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { leagueName: true } });
  const users = await db.user.findMany({ where: { leagueName: me.leagueName, ...onboarded }, select: personSelect });
  const xp = await weeklyXpByUser(db, users.map((u) => u.id), now);
  const standings = leagueStandings(users.map((u) => toMember(u, xp)));
  return { name: me.leagueName, daysLeft: leagueDaysLeft(now), standings, window: standingsWindow(standings, userId) };
}

export async function getGroupStandings(db: Db, userId: string, now = new Date()) {
  const groups = await db.studyGroup.findMany({
    where: { members: { some: { userId } } },
    include: { members: { where: { user: onboarded }, include: { user: { select: personSelect } } } },
    orderBy: { createdAt: "asc" },
  });
  const ids = [...new Set(groups.flatMap((g) => g.members.map((m) => m.userId)))];
  const xp = await weeklyXpByUser(db, ids, now);
  return groups.map((g) => ({ id: g.id, name: g.name, standings: leagueStandings(g.members.map((m) => toMember(m.user, xp))) }));
}

export async function getConceptProgress(db: Db, userId: string, opts: { publishedOnly?: boolean } = { publishedOnly: true }) {
  const concepts = await db.concept.findMany({
    where: opts.publishedOnly ? { published: true } : {},
    orderBy: { order: "asc" },
    select: { id: true, slug: true, title: true, summary: true, icon: true, _count: { select: { questions: true } } },
  });
  const [mastery, lessons] = await Promise.all([
    db.questionMastery.findMany({ where: { userId }, select: { question: { select: { conceptId: true } } } }),
    db.lessonCompletion.groupBy({ by: ["conceptId"], where: { userId }, _sum: { xp: true }, _count: { _all: true } }),
  ]);
  const masteredBy = new Map<string, number>();
  for (const m of mastery) masteredBy.set(m.question.conceptId, (masteredBy.get(m.question.conceptId) ?? 0) + 1);
  const lessonBy = new Map(lessons.map((l) => [l.conceptId, l]));
  return concepts.map((c) => {
    const total = c._count.questions;
    const mastered = masteredBy.get(c.id) ?? 0;
    return {
      id: c.id,
      slug: c.slug,
      title: c.title,
      summary: c.summary,
      icon: c.icon,
      total,
      mastered,
      progress: total ? mastered / total : 0,
      xp: lessonBy.get(c.id)?._sum.xp ?? 0,
      lessons: lessonBy.get(c.id)?._count._all ?? 0,
    };
  });
}

export type ConceptProgress = Awaited<ReturnType<typeof getConceptProgress>>[number];

/** Which type × level combos are unlocked for this user and have cases. */
export async function getCaseAvailability(db: Db, userId: string) {
  const [user, results, counts] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { gateMode: true } }),
    getGateResults(db, userId),
    db.case.groupBy({ by: ["caseType", "difficulty"], where: { published: true }, _count: { _all: true } }),
  ]);
  const gates = gateMap(results, user.gateMode);
  const count = new Map(counts.map((c) => [`${c.caseType}|${c.difficulty}`, c._count._all]));
  return CASE_TYPES.map((t) => ({
    caseType: t,
    levels: DIFFICULTIES.map((d) => ({ difficulty: d, unlocked: gates[t][d], cases: count.get(`${t}|${d}`) ?? 0 })),
  }));
}

export type CaseAvailability = Awaited<ReturnType<typeof getCaseAvailability>>;

export async function getHomeData(db: Db, userId: string, now = new Date()) {
  const [progress, league, groups, friends, concepts, availability] = await Promise.all([
    getUserProgress(db, userId, now),
    getLeague(db, userId, now),
    getGroupStandings(db, userId, now),
    db.friendship.findMany({
      where: { userId, friend: onboarded },
      select: { friend: { select: personSelect } },
      orderBy: { friend: { firstName: "asc" } },
    }),
    getConceptProgress(db, userId),
    getCaseAvailability(db, userId),
  ]);
  return { progress, league, groups, friends: friends.map((f) => toPerson(f.friend)), concepts, availability };
}
