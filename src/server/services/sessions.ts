/**
 * Live case session state machine (U10, KTD2). The database is authoritative;
 * every transition validates the actor's participation and role.
 *
 *   LOBBY --(roles + case + both ready)--> ACTIVE --(solve)--> SOLVED
 *   SOLVED --(switch roles | new case)--> LOBBY (round + 1)
 *   any open state --(close)--> CLOSED
 */
import type { CaseSession } from "@prisma/client";
import type { Db } from "@/lib/db";
import { isLevelUnlocked } from "@/lib/rules/gates";
import { averageScore, validateRubric } from "@/lib/rules/rubric";
import { XP_INTERVIEWEE_SOLVE, XP_INTERVIEWER_SOLVE } from "@/lib/rules/xp";
import type { CaseSummary, HintView, PersonRef, SessionView } from "@/lib/realtime/events";
import { isCaseType, isDifficulty, type CaseType, type Difficulty, type Role, type SessionStatus } from "@/lib/types";
import { personSelect, ServiceError } from "./invites";
import { getGateResults, recordCaseSolved } from "./progress";

export { ServiceError };

const OPEN: SessionStatus[] = ["LOBBY", "ACTIVE", "SOLVED"];

async function load(db: Db, sessionId: string) {
  const s = await db.caseSession.findUnique({ where: { id: sessionId } });
  if (!s) throw new ServiceError("Session not found");
  return s;
}

export function isParticipant(s: Pick<CaseSession, "hostId" | "guestId">, userId: string) {
  return s.hostId === userId || s.guestId === userId;
}

function assertParticipant(s: CaseSession, userId: string) {
  if (!isParticipant(s, userId)) throw new ServiceError("This session is private");
}

function assertStatus(s: CaseSession, ...allowed: SessionStatus[]) {
  if (!allowed.includes(s.status as SessionStatus)) {
    if (s.status === "CLOSED") throw new ServiceError("This session has ended");
    throw new ServiceError("That action isn't available right now");
  }
}

function partnerOf(s: CaseSession, userId: string) {
  return s.hostId === userId ? s.guestId : s.hostId;
}

function roleOf(s: CaseSession, userId: string): Role | null {
  if (s.interviewerId === userId) return "interviewer";
  if (s.intervieweeId === userId) return "interviewee";
  return null;
}

const resetReady = { hostReady: false, guestReady: false };

/** Whose progress gates the case pool: the interviewee, else the host (Key Decisions). */
function gateUserId(s: CaseSession) {
  return s.intervieweeId ?? s.hostId;
}

async function casePool(db: Db, s: CaseSession): Promise<{ pool: CaseSummary[]; locked: boolean }> {
  if (!s.caseType || !s.difficulty) return { pool: [], locked: false };
  const uid = gateUserId(s);
  const [user, results] = await Promise.all([db.user.findUniqueOrThrow({ where: { id: uid }, select: { gateMode: true } }), getGateResults(db, uid)]);
  if (!isLevelUnlocked(results, s.caseType, s.difficulty, user.gateMode)) return { pool: [], locked: true };
  const pool = await db.case.findMany({
    where: { caseType: s.caseType, difficulty: s.difficulty, published: true },
    select: { id: true, title: true, caseType: true, difficulty: true },
    orderBy: { title: "asc" },
  });
  return { pool, locked: false };
}

/* ---------------- transitions ---------------- */

export async function pickRole(db: Db, sessionId: string, userId: string, role: Role) {
  const s = await load(db, sessionId);
  assertParticipant(s, userId);
  assertStatus(s, "LOBBY");
  const partner = partnerOf(s, userId);
  if (!partner) throw new ServiceError("Waiting for a partner to join");
  const me = role === "interviewer" ? { interviewerId: userId, intervieweeId: partner } : { interviewerId: partner, intervieweeId: userId };
  const next = await db.caseSession.update({ where: { id: s.id }, data: { ...me, ...resetReady } });
  // Roles change whose gates apply; drop a selected case the new interviewee can't play.
  if (next.caseId) {
    const { pool } = await casePool(db, next);
    if (!pool.some((c) => c.id === next.caseId)) await db.caseSession.update({ where: { id: s.id }, data: { caseId: null } });
  }
}

export async function setCaseFilter(db: Db, sessionId: string, userId: string, caseType: string, difficulty: number) {
  const s = await load(db, sessionId);
  assertParticipant(s, userId);
  assertStatus(s, "LOBBY");
  if (!isCaseType(caseType) || !isDifficulty(difficulty)) throw new ServiceError("Invalid case filter");
  await db.caseSession.update({ where: { id: s.id }, data: { caseType, difficulty, caseId: null, ...resetReady } });
}

export async function selectCase(db: Db, sessionId: string, userId: string, caseId: string | "random", rng: () => number = Math.random) {
  const s = await load(db, sessionId);
  assertParticipant(s, userId);
  assertStatus(s, "LOBBY");
  const { pool, locked } = await casePool(db, s);
  if (locked) throw new ServiceError("That level is locked for the interviewee");
  if (!pool.length) throw new ServiceError("No cases for this type and level yet");
  const chosen = caseId === "random" ? pool[Math.floor(rng() * pool.length)] : pool.find((c) => c.id === caseId);
  if (!chosen) throw new ServiceError("That case isn't available");
  await db.caseSession.update({ where: { id: s.id }, data: { caseId: chosen.id, ...resetReady } });
}

/** Both players must be ready; the case then launches (R16 agreement). */
export async function setReady(db: Db, sessionId: string, userId: string, ready: boolean) {
  const s = await load(db, sessionId);
  assertParticipant(s, userId);
  assertStatus(s, "LOBBY");
  if (ready && (!s.guestId || !s.interviewerId || !s.intervieweeId)) throw new ServiceError("Pick roles first");
  if (ready && !s.caseId) throw new ServiceError("Choose a case first");
  const flags = s.hostId === userId ? { hostReady: ready } : { guestReady: ready };
  const next = await db.caseSession.update({ where: { id: s.id }, data: flags });
  if (next.hostReady && next.guestReady) {
    // Conditional update so two simultaneous "ready" events start the case once.
    await db.caseSession.updateMany({ where: { id: s.id, status: "LOBBY" }, data: { status: "ACTIVE", startedAt: new Date(), ...resetReady } });
  }
}

export async function revealFact(db: Db, sessionId: string, userId: string, factId: string) {
  const s = await load(db, sessionId);
  assertParticipant(s, userId);
  assertStatus(s, "ACTIVE");
  if (s.interviewerId !== userId) throw new ServiceError("Only the interviewer can reveal facts");
  const fact = await db.caseItem.findFirst({ where: { id: factId, caseId: s.caseId!, kind: "fact", archivedAt: null } });
  if (!fact) throw new ServiceError("Fact not found");
  await db.sessionReveal.upsert({
    where: { sessionId_round_caseItemId: { sessionId: s.id, round: s.round, caseItemId: fact.id } },
    create: { sessionId: s.id, round: s.round, caseItemId: fact.id },
    update: {},
  });
}

/** I'm Stuck: the next unused hint, or null when none remain (R23). */
export async function useHint(db: Db, sessionId: string, userId: string): Promise<HintView | null> {
  const s = await load(db, sessionId);
  assertParticipant(s, userId);
  assertStatus(s, "ACTIVE");
  if (s.intervieweeId !== userId) throw new ServiceError("Only the interviewee can ask for a hint");
  const used = await db.sessionHintUse.findMany({ where: { sessionId: s.id, round: s.round }, select: { caseItemId: true } });
  const next = await db.caseItem.findFirst({
    where: { caseId: s.caseId!, kind: "hint", archivedAt: null, id: { notIn: used.map((u) => u.caseItemId) } },
    orderBy: { order: "asc" },
  });
  if (!next) return null;
  const row = await db.sessionHintUse.create({ data: { sessionId: s.id, round: s.round, caseItemId: next.id } });
  return { id: next.id, text: next.text, usedAt: row.usedAt.toISOString() };
}

export async function saveNotepad(db: Db, sessionId: string, userId: string, content: string) {
  const s = await load(db, sessionId);
  assertParticipant(s, userId);
  assertStatus(s, "ACTIVE", "SOLVED");
  if (s.intervieweeId !== userId) throw new ServiceError("The notepad belongs to the interviewee");
  const text = content.slice(0, NOTEPAD_MAX_CHARS);
  await db.sessionNote.upsert({
    where: { sessionId_round_userId: { sessionId: s.id, round: s.round, userId } },
    create: { sessionId: s.id, round: s.round, userId, content: text },
    update: { content: text },
  });
  return { round: s.round };
}

const NOTEPAD_MAX_CHARS = 50_000;

export async function solveCase(db: Db, sessionId: string, userId: string, scores: Array<{ criterion: string; score: number; notes: string }>) {
  const s = await load(db, sessionId);
  assertParticipant(s, userId);
  assertStatus(s, "ACTIVE");
  if (s.interviewerId !== userId) throw new ServiceError("Only the interviewer can mark the case solved");
  const invalid = validateRubric(scores);
  if (invalid) throw new ServiceError(invalid);
  const c = await db.case.findUnique({ where: { id: s.caseId ?? "" } });
  if (!c) throw new ServiceError("Case not found");
  await db.$transaction(async (tx) => {
    // Status guard makes a double submit a no-op.
    const moved = await tx.caseSession.updateMany({ where: { id: s.id, status: "ACTIVE" }, data: { status: "SOLVED", solvedAt: new Date() } });
    if (moved.count === 0) throw new ServiceError("This case was already solved");
    await tx.rubricScore.createMany({ data: scores.map((x) => ({ sessionId: s.id, round: s.round, criterion: x.criterion, score: x.score, notes: x.notes ?? "" })) });
    await recordCaseSolved(tx, {
      sessionId: s.id,
      round: s.round,
      caseId: c.id,
      caseType: c.caseType,
      difficulty: c.difficulty,
      interviewerId: s.interviewerId!,
      intervieweeId: s.intervieweeId!,
      avgScore: averageScore(scores.map((x) => x.score)),
    });
  });
}

/** Post-case dialog actions: the first one the server receives wins (status guard). */
export async function nextRound(db: Db, sessionId: string, userId: string, mode: "switchRoles" | "newCase") {
  const s = await load(db, sessionId);
  assertParticipant(s, userId);
  assertStatus(s, "SOLVED");
  const roles = mode === "switchRoles" ? { interviewerId: s.intervieweeId, intervieweeId: s.interviewerId } : {};
  const moved = await db.caseSession.updateMany({
    where: { id: s.id, status: "SOLVED", round: s.round },
    data: { status: "LOBBY", round: s.round + 1, caseId: null, startedAt: null, solvedAt: null, ...resetReady, ...roles },
  });
  if (moved.count === 0) throw new ServiceError("Your partner already chose");
}

export async function closeSession(db: Db, sessionId: string, userId: string) {
  const s = await load(db, sessionId);
  assertParticipant(s, userId);
  const moved = await db.caseSession.updateMany({ where: { id: s.id, status: { in: OPEN } }, data: { status: "CLOSED", closedAt: new Date(), closedById: userId } });
  if (moved.count) await db.sessionInvite.updateMany({ where: { sessionId: s.id, status: "PENDING" }, data: { status: "CANCELLED" } });
  return moved.count > 0;
}

export async function openSessionsFor(db: Db, userId: string) {
  return db.caseSession.findMany({ where: { status: { in: OPEN }, OR: [{ hostId: userId }, { guestId: userId }] }, select: { id: true } });
}

/* ---------------- projection ---------------- */

/** Role-aware view: the interviewee never receives unrevealed facts, unused hints, the tree, transcript or rubric. */
export async function buildView(db: Db, sessionId: string, viewerId: string, connected: Set<string>): Promise<SessionView> {
  const s = await load(db, sessionId);
  assertParticipant(s, viewerId);
  const partnerId = partnerOf(s, viewerId);
  const [me, partner, gateUser, pending] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: viewerId }, select: personSelect }),
    partnerId ? db.user.findUnique({ where: { id: partnerId }, select: personSelect }) : null,
    db.user.findUnique({ where: { id: gateUserId(s) }, select: personSelect }),
    db.sessionInvite.findFirst({ where: { sessionId: s.id, status: "PENDING" }, include: { to: { select: personSelect } } }),
  ]);
  const ready = (uid: string) => (s.hostId === uid ? s.hostReady : s.guestReady);
  const { pool, locked } = s.status === "LOBBY" ? await casePool(db, s) : { pool: [], locked: false };

  // Only the interviewer's projection uses the transcript and tree.
  const forInterviewer = roleOf(s, viewerId) === "interviewer";
  const c = s.caseId
    ? await db.case.findUnique({
        where: { id: s.caseId },
        include: {
          items: { where: { archivedAt: null }, orderBy: { order: "asc" } },
          transcript: forInterviewer ? { orderBy: { order: "asc" } } : false,
          nodes: forInterviewer ? { orderBy: [{ order: "asc" }] } : false,
        },
      })
    : null;

  const inCase = Boolean(c) && (s.status === "ACTIVE" || s.status === "SOLVED");
  const [reveals, hintUses, note, result] = inCase
    ? await Promise.all([
        db.sessionReveal.findMany({ where: { sessionId: s.id, round: s.round }, orderBy: { revealedAt: "asc" } }),
        db.sessionHintUse.findMany({ where: { sessionId: s.id, round: s.round }, orderBy: { usedAt: "asc" } }),
        s.intervieweeId === viewerId ? db.sessionNote.findUnique({ where: { sessionId_round_userId: { sessionId: s.id, round: s.round, userId: viewerId } } }) : null,
        s.status === "SOLVED" ? db.caseResult.findFirst({ where: { sessionId: s.id, round: s.round } }) : null,
      ])
    : [[], [], null, null];

  const revealedAt = new Map(reveals.map((r) => [r.caseItemId, r.revealedAt.toISOString()]));
  const usedAt = new Map(hintUses.map((h) => [h.caseItemId, h.usedAt.toISOString()]));
  const items = c?.items ?? [];
  const facts = items.filter((i) => i.kind === "fact");
  const hints = items.filter((i) => i.kind === "hint");
  const role = roleOf(s, viewerId);
  const summary = c ? { id: c.id, title: c.title, caseType: c.caseType, difficulty: c.difficulty } : null;

  return {
    id: s.id,
    status: s.status as SessionStatus,
    round: s.round,
    me: { ...me, role, ready: ready(viewerId) },
    partner: partner ? { ...partner, role: roleOf(s, partner.id), ready: ready(partner.id), connected: connected.has(partner.id) } : null,
    isHost: s.hostId === viewerId,
    caseType: (s.caseType as CaseType) ?? null,
    difficulty: (s.difficulty as Difficulty) ?? null,
    selectedCase: summary,
    casePool: pool,
    poolLocked: locked,
    gateFor: gateUser,
    pendingInvite: pending ? { inviteId: pending.id, to: pending.to as PersonRef } : null,
    hintsUsedCount: hintUses.length,
    hintsTotal: hints.length,
    interviewer:
      inCase && role === "interviewer" && c
        ? {
            ...summary!,
            problemStatement: c.problemStatement,
            facts: facts.map((f) => ({ id: f.id, text: f.text, revealedAt: revealedAt.get(f.id) ?? null })),
            hints: hints.map((h) => ({ id: h.id, text: h.text, usedAt: usedAt.get(h.id) ?? null })),
            recommendations: items.filter((i) => i.kind === "recommendation").map((i) => ({ id: i.id, text: i.text })),
            observations: items.filter((i) => i.kind === "observation").map((i) => ({ id: i.id, text: i.text })),
            transcript: (c.transcript ?? []).map((t) => ({ id: t.id, speaker: t.speaker as "interviewer" | "candidate", text: t.text })),
            tree: (c.nodes ?? []).map((n) => ({ id: n.id, parentId: n.parentId, label: n.label, isCorrectPath: n.isCorrectPath, order: n.order })),
          }
        : null,
    interviewee:
      inCase && role === "interviewee" && c
        ? {
            ...summary!,
            problemStatement: c.problemStatement,
            revealedFacts: reveals
              .map((r) => ({ r, f: facts.find((f) => f.id === r.caseItemId) }))
              .filter((x) => x.f)
              .map(({ r, f }) => ({ id: f!.id, text: f!.text, revealedAt: r.revealedAt.toISOString() })),
            usedHints: hintUses
              .map((h) => ({ h, i: hints.find((x) => x.id === h.caseItemId) }))
              .filter((x) => x.i)
              .map(({ h, i }) => ({ id: i!.id, text: i!.text, usedAt: h.usedAt.toISOString() })),
            hintsRemaining: Math.max(0, hints.length - hintUses.length),
            notepad: note?.content ?? "",
          }
        : null,
    result: result
      ? { avgScore: result.avgScore, xp: { [result.intervieweeId]: XP_INTERVIEWEE_SOLVE, ...(result.interviewerId ? { [result.interviewerId]: XP_INTERVIEWER_SOLVE } : {}) } }
      : null,
    closedBy: s.closedById,
  };
}
