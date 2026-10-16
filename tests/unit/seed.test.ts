import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { beforeAll, describe, expect, it } from "vitest";
import { CASE_TYPES } from "@/lib/types";
import { db, resetAndSeed } from "./helpers/db";

describe("seed", () => {
  beforeAll(async () => {
    await resetAndSeed();
  });

  it("creates exactly one admin owner with the expected identity", async () => {
    const owners = await db.user.findMany({ where: { username: "davidsathyandevice" } });
    expect(owners).toHaveLength(1);
    expect(owners[0]).toMatchObject({ firstName: "David", lastName: "Sathyan", email: "davidsathyandevice@gmail.com", googleSub: null });
  });

  it("seeds Roy, Mihaela and Ankit as friends of the owner, plus a study group of four", async () => {
    const owner = await db.user.findUniqueOrThrow({ where: { username: "davidsathyandevice" }, include: { friendships: { include: { friend: true } } } });
    expect(owner.friendships.map((f) => f.friend.firstName).sort()).toEqual(["Ankit", "Mihaela", "Roy"]);
    const group = await db.studyGroup.findFirstOrThrow({ include: { members: true } });
    expect(group.members).toHaveLength(4);
  });

  it("ensure-db run twice leaves one seeded dataset", async () => {
    const root = resolve(import.meta.dirname, "../..");
    const file = "ensure-test.db";
    const clean = () => ["", "-journal", "-wal", "-shm"].forEach((s) => rmSync(resolve(root, "prisma", file + s), { force: true }));
    clean();
    const run = () =>
      spawnSync(process.execPath, [resolve(root, "node_modules/tsx/dist/cli.mjs"), "scripts/ensure-db.ts"], {
        cwd: root,
        env: { ...process.env, DATABASE_URL: `file:./${file}` },
        stdio: "pipe",
      });
    const first = run();
    expect(first.status, first.stderr.toString() + first.stdout.toString()).toBe(0);
    const second = run();
    expect(second.status, second.stderr.toString() + second.stdout.toString()).toBe(0);
    const probe = new PrismaClient({ datasources: { db: { url: `file:./${file}` } } });
    try {
      expect(await probe.user.count()).toBe(await db.user.count());
      expect(await probe.case.count()).toBe(await db.case.count());
    } finally {
      await probe.$disconnect();
      clean();
    }
  }, 120_000);

  it("seeds the Mumbai case exactly as specified", async () => {
    const c = await db.case.findFirstOrThrow({
      where: { title: "Diagnostic Center – Mumbai" },
      include: { items: true, transcript: { orderBy: { order: "asc" } }, nodes: true },
    });
    expect(c).toMatchObject({ caseType: "Profitability", difficulty: 1 });
    const count = (kind: string) => c.items.filter((i) => i.kind === kind).length;
    expect([count("fact"), count("hint"), count("recommendation"), count("observation")]).toEqual([5, 3, 3, 2]);
    expect(c.transcript).toHaveLength(33);
    expect(c.transcript[0].speaker).toBe("interviewer");
    c.transcript.forEach((t, i) => expect(t.speaker).toBe(i % 2 === 0 ? "interviewer" : "candidate"));
    expect(c.nodes).toHaveLength(19);
    expect(c.nodes.filter((n) => n.isCorrectPath).map((n) => n.label).sort()).toEqual(
      ["Demand", "Direct Referrals", "Doctor", "External", "In-Center Visits", "Indirect Competition", "Number of Patients", "Pathology", "Revenues"].sort(),
    );
  });

  it("gives every question at least two options and exactly one correct", async () => {
    const qs = await db.question.findMany({ include: { options: true } });
    expect(qs.length).toBeGreaterThanOrEqual(15);
    for (const q of qs) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.options.filter((o) => o.isCorrect)).toHaveLength(1);
    }
    expect(await db.question.count({ where: { kind: "application" } })).toBeGreaterThan(0);
  });

  it("covers every case type at Level 1 and Profitability at Levels 2 and 3", async () => {
    for (const t of CASE_TYPES) expect(await db.case.count({ where: { caseType: t, difficulty: 1, published: true } })).toBeGreaterThan(0);
    expect(await db.case.count({ where: { caseType: "Profitability", difficulty: 2 } })).toBeGreaterThan(0);
    expect(await db.case.count({ where: { caseType: "Profitability", difficulty: 3 } })).toBeGreaterThan(0);
  });

  it("gives every seeded tree one root and a blue path that never hangs off a grey node", async () => {
    const cases = await db.case.findMany({ include: { nodes: true } });
    for (const c of cases) {
      const roots = c.nodes.filter((n) => n.parentId === null);
      expect(roots, c.title).toHaveLength(1);
      const byId = new Map(c.nodes.map((n) => [n.id, n]));
      for (const node of c.nodes.filter((n) => n.isCorrectPath && n.parentId)) {
        expect(byId.get(node.parentId!)?.isCorrectPath, `${c.title}: ${node.label}`).toBe(true);
      }
    }
  });
});
