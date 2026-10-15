import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SessionView } from "@/lib/realtime/events";
import { RUBRIC_CRITERIA } from "@/lib/rules/rubric";
import { db, resetAndSeed, userId } from "./helpers/db";
import { call, connectAs, nextEvent, sleep, startHarness, type Client, type Harness } from "./helpers/realtime";

let h: Harness;
let david: string, roy: string;
let mumbaiId: string;

const fullRubric = (score = 5) => RUBRIC_CRITERIA.map((c) => ({ criterion: c.key, score, notes: "" }));

/** Latest session:state each client received. */
function track(c: Client) {
  const box: { view: SessionView | null } = { view: null };
  c.on("session:state", (v) => (box.view = v));
  return box;
}

async function until(box: { view: SessionView | null }, pred: (v: SessionView) => boolean, ms = 2000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (box.view && pred(box.view)) return box.view;
    await sleep(10);
  }
  throw new Error(`timed out; last view status=${box.view?.status}`);
}

async function lobby(caseType = "Profitability", difficulty = 1) {
  const s = await db.caseSession.create({ data: { hostId: david, guestId: roy, caseType, difficulty } });
  const a = await connectAs(h, david);
  const b = await connectAs(h, roy);
  const va = track(a);
  const vb = track(b);
  expect((await call(a, "session:join", { sessionId: s.id })).ok).toBe(true);
  expect((await call(b, "session:join", { sessionId: s.id })).ok).toBe(true);
  await sleep(50);
  return { id: s.id, a, b, va, vb };
}

async function startMumbai(x: Awaited<ReturnType<typeof lobby>>) {
  await call(x.a, "session:pickRole", { sessionId: x.id, role: "interviewer" });
  await call(x.a, "session:selectCase", { sessionId: x.id, caseId: mumbaiId });
  await call(x.a, "session:ready", { sessionId: x.id, ready: true });
  const r = await call(x.b, "session:ready", { sessionId: x.id, ready: true });
  expect(r.ok).toBe(true);
  await until(x.va, (v) => v.status === "ACTIVE" && Boolean(v.interviewer));
  await until(x.vb, (v) => v.status === "ACTIVE" && Boolean(v.interviewee));
}

beforeAll(async () => {
  await resetAndSeed();
  [david, roy] = [await userId("davidsathyandevice"), await userId("roy")];
  mumbaiId = (await db.case.findFirstOrThrow({ where: { title: "Diagnostic Center – Mumbai" } })).id;
});
beforeEach(async () => {
  await db.caseResult.deleteMany();
  h = await startHarness();
});
afterEach(async () => {
  await h.close();
});

describe("lobby", () => {
  it("assigns the complementary role to the partner and lets either flip it (R16)", async () => {
    const x = await lobby();
    await call(x.a, "session:pickRole", { sessionId: x.id, role: "interviewer" });
    await sleep(60);
    expect(x.vb.view!.me.role).toBe("interviewee");
    expect(x.va.view!.me.role).toBe("interviewer");
    await call(x.b, "session:pickRole", { sessionId: x.id, role: "interviewer" });
    await sleep(60);
    expect(x.va.view!.me.role).toBe("interviewee");
  });

  it("won't launch without a case", async () => {
    const x = await lobby();
    await call(x.a, "session:pickRole", { sessionId: x.id, role: "interviewer" });
    const r = await call(x.a, "session:ready", { sessionId: x.id, ready: true });
    expect(r).toEqual({ ok: false, error: "Choose a case first" });
    expect((await db.caseSession.findUniqueOrThrow({ where: { id: x.id } })).status).toBe("LOBBY");
  });

  it("hides Level 2 from the pool when the interviewee hasn't unlocked it", async () => {
    const x = await lobby("Profitability", 2);
    await call(x.a, "session:pickRole", { sessionId: x.id, role: "interviewer" });
    await sleep(60);
    expect(x.va.view!.poolLocked).toBe(true);
    expect(x.va.view!.casePool).toEqual([]);
  });

  it("clears both ready flags when the case changes", async () => {
    const x = await lobby();
    await call(x.a, "session:pickRole", { sessionId: x.id, role: "interviewer" });
    await call(x.a, "session:selectCase", { sessionId: x.id, caseId: mumbaiId });
    await call(x.a, "session:ready", { sessionId: x.id, ready: true });
    await call(x.b, "session:selectCase", { sessionId: x.id, caseId: "random" });
    const s = await db.caseSession.findUniqueOrThrow({ where: { id: x.id } });
    expect([s.hostReady, s.guestReady, s.status]).toEqual([false, false, "LOBBY"]);
  });

  it("refuses a non-participant", async () => {
    const x = await lobby();
    const outsider = await connectAs(h, await userId("ankit"));
    expect(await call(outsider, "session:join", { sessionId: x.id })).toEqual({ ok: false, error: "This session is private" });
  });
});

describe("active case", () => {
  it("never sends the interviewee unrevealed facts or unused hints", async () => {
    const x = await lobby();
    await startMumbai(x);
    const v = x.vb.view!;
    expect(v.status).toBe("ACTIVE");
    expect(v.interviewer).toBeNull();
    expect(v.interviewee!.revealedFacts).toEqual([]);
    const payload = JSON.stringify(v);
    expect(payload).not.toContain("Colaba");
    expect(payload).not.toContain("value chain");
    expect(x.va.view!.interviewer!.facts).toHaveLength(5);
  });

  it("delivers a revealed fact to the interviewee and refuses reveals from the interviewee (R17)", async () => {
    const x = await lobby();
    await startMumbai(x);
    const colaba = x.va.view!.interviewer!.facts.find((f) => f.text.startsWith("Colaba"))!;
    const t0 = Date.now();
    await call(x.a, "session:reveal", { sessionId: x.id, factId: colaba.id });
    const v = await until(x.vb, (view) => view.interviewee!.revealedFacts.length > 0);
    expect(Date.now() - t0).toBeLessThan(150);
    expect(v.interviewee!.revealedFacts.map((f) => f.text)).toEqual([colaba.text]);
    expect((await call(x.b, "session:reveal", { sessionId: x.id, factId: colaba.id })).ok).toBe(false);
    await call(x.a, "session:reveal", { sessionId: x.id, factId: colaba.id });
    expect(await db.sessionReveal.count({ where: { sessionId: x.id } })).toBe(1);
  });

  it("keeps reveal order in the interviewee feed (R21)", async () => {
    const x = await lobby();
    await startMumbai(x);
    const f = x.va.view!.interviewer!.facts;
    for (const i of [0, 2, 1]) {
      await call(x.a, "session:reveal", { sessionId: x.id, factId: f[i].id });
      await sleep(15);
    }
    const v = await until(x.vb, (view) => view.interviewee!.revealedFacts.length === 3);
    expect(v.interviewee!.revealedFacts.map((r) => r.id)).toEqual([f[0].id, f[2].id, f[1].id]);
  });

  it("serves hints in order, tells the interviewer, and stops after the last (R23)", async () => {
    const x = await lobby();
    await startMumbai(x);
    const first = await call(x.b, "session:hint", { sessionId: x.id });
    expect(first.hint.text).toMatch(/^Important to start by understanding the various functions/);
    await sleep(60);
    expect(x.va.view!.hintsUsedCount).toBe(1);
    await call(x.b, "session:hint", { sessionId: x.id });
    const third = await call(x.b, "session:hint", { sessionId: x.id });
    expect(third.hint.text).toMatch(/mathematical breakdown of revenues/);
    expect((await call(x.b, "session:hint", { sessionId: x.id })).hint).toBeNull();
  });

  it("keeps the notepad private and persistent (R22)", async () => {
    const x = await lobby();
    await startMumbai(x);
    await call(x.b, "session:notepad", { sessionId: x.id, content: "Profit = Rev - Cost" });
    const again = await call(x.b, "session:join", { sessionId: x.id });
    expect(again.view.interviewee.notepad).toBe("Profit = Rev - Cost");
    const forA = await call(x.a, "session:join", { sessionId: x.id });
    expect(JSON.stringify(forA.view)).not.toContain("Profit = Rev - Cost");
  });

  it("rejects a solve with five of six scores (R20)", async () => {
    const x = await lobby();
    await startMumbai(x);
    const r = await call(x.a, "session:solve", { sessionId: x.id, scores: fullRubric().slice(0, 5) });
    expect(r.ok).toBe(false);
  });
});

describe("after the solve", () => {
  it("shows both players the dialog; Switch Roles swaps roles into round 2 (R24)", async () => {
    const x = await lobby();
    await startMumbai(x);
    expect((await call(x.a, "session:solve", { sessionId: x.id, scores: fullRubric(5) })).ok).toBe(true);
    await until(x.va, (v) => v.status === "SOLVED");
    expect((await until(x.vb, (v) => v.status === "SOLVED")).result?.avgScore).toBe(5);
    await call(x.b, "session:switchRoles", { sessionId: x.id });
    const va = await until(x.va, (v) => v.round === 2);
    expect(va).toMatchObject({ status: "LOBBY", round: 2 });
    expect(va.me.role).toBe("interviewee");
    expect((await until(x.vb, (v) => v.round === 2)).me.role).toBe("interviewer");
  });

  it("lets the first post-case action win when both click at once", async () => {
    const x = await lobby();
    await startMumbai(x);
    await call(x.a, "session:solve", { sessionId: x.id, scores: fullRubric(4) });
    const [r1, r2] = await Promise.all([call(x.a, "session:switchRoles", { sessionId: x.id }), call(x.b, "session:close", { sessionId: x.id })]);
    const s = await db.caseSession.findUniqueOrThrow({ where: { id: x.id } });
    expect(["LOBBY", "CLOSED"]).toContain(s.status);
    expect(r1.ok || r2.ok).toBe(true);
    if (s.status === "LOBBY") expect(s.round).toBe(2);
  });

  it("unlocks Level 2 for the interviewee after a strong Level 1 solve", async () => {
    const x = await lobby();
    await startMumbai(x);
    await call(x.a, "session:solve", { sessionId: x.id, scores: fullRubric(4) });
    await call(x.a, "session:newCase", { sessionId: x.id });
    await call(x.a, "session:setCaseFilter", { sessionId: x.id, caseType: "Profitability", difficulty: 2 });
    await sleep(60);
    expect(x.va.view!.poolLocked).toBe(false);
    expect(x.va.view!.casePool.length).toBeGreaterThan(0);
  });

  it("End session mid-case closes it for both with no result (R16/U10)", async () => {
    const x = await lobby();
    await startMumbai(x);
    const closed = nextEvent(x.b, "session:closed");
    await call(x.a, "session:close", { sessionId: x.id });
    expect((await closed).by?.firstName).toBe("David");
    expect(await db.caseResult.count({ where: { sessionId: x.id } })).toBe(0);
    expect((await call(x.b, "session:join", { sessionId: x.id })).ok).toBe(true); // can view, but…
    expect((await call(x.a, "session:reveal", { sessionId: x.id, factId: "x" })).error).toBe("This session has ended");
  });
});
