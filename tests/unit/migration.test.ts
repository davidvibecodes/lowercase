import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const prismaCli = resolve(root, "node_modules/prisma/build/index.js");
const INIT = "20261015084915_init";

const dir = mkdtempSync(join(tmpdir(), "lc-migration-"));
const dbFile = join(dir, "replay.db");
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function deploy() {
  const r = spawnSync(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(dir, "schema.prisma")], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: `file:${dbFile.replace(/\\/g, "/")}` },
    stdio: "pipe",
  });
  if (r.status !== 0) throw new Error(`migrate deploy failed: ${r.stderr?.toString()}`);
}

/** Rows in every child table of User, a 3-level tree, a reveal and a hint use, written with the init schema. */
function populateOldSchema(sql: DatabaseSync) {
  const now = "2026-10-15T10:00:00.000Z";
  sql.exec(`
    INSERT INTO "User" (id, username, firstName, lastName, email, isAdmin) VALUES
      ('u1','owner','David','S','owner@example.com',1), ('u2','roy','Roy','C','roy@example.com',0);
    INSERT INTO Friendship (id, userId, friendId) VALUES ('f1','u1','u2'), ('f2','u2','u1');
    INSERT INTO StudyGroup (id, name, ownerId) VALUES ('g1','Squad','u1');
    INSERT INTO GroupMember (groupId, userId) VALUES ('g1','u1'), ('g1','u2');
    INSERT INTO Concept (id, slug, title, summary, "order") VALUES ('c1','vrio','VRIO','s',0);
    INSERT INTO Question (id, conceptId, prompt, explanation) VALUES ('q1','c1','p','e');
    INSERT INTO QuestionMastery (userId, questionId) VALUES ('u1','q1');
    INSERT INTO AnswerEvent (id, userId, questionId, conceptId, firstAttemptCorrect) VALUES ('a1','u1','q1','c1',1);
    INSERT INTO LessonCompletion (id, userId, conceptId, questions, firstTryCorrect, xp) VALUES ('l1','u1','c1',6,5,90);
    INSERT INTO DailyActivity (userId, day, xp) VALUES ('u1','2026-10-15',90);
    INSERT INTO "Case" (id, title, caseType, difficulty, problemStatement, updatedAt) VALUES ('k1','Case','Profitability',1,'p','${now}');
    INSERT INTO CaseItem (id, caseId, kind, "order", text) VALUES ('i1','k1','fact',0,'fact'), ('i2','k1','hint',0,'hint');
    INSERT INTO TranscriptTurn (id, caseId, "order", speaker, text) VALUES ('t1','k1',0,'interviewer','hi');
    INSERT INTO IssueTreeNode (id, caseId, parentId, label, isCorrectPath) VALUES
      ('n1','k1',NULL,'Profit',1), ('n2','k1','n1','Revenue',1), ('n3','k1','n2','Price',0);
    INSERT INTO CaseSession (id, hostId, guestId, status, caseId) VALUES ('s1','u1','u2','ACTIVE','k1');
    INSERT INTO SessionInvite (id, sessionId, fromId, toId) VALUES ('v1','s1','u1','u2');
    INSERT INTO SessionReveal (id, sessionId, round, caseItemId) VALUES ('r1','s1',1,'i1');
    INSERT INTO SessionHintUse (id, sessionId, round, caseItemId) VALUES ('h1','s1',1,'i2');
    INSERT INTO SessionNote (sessionId, round, userId, updatedAt) VALUES ('s1',1,'u2','${now}');
    INSERT INTO RubricScore (id, sessionId, round, criterion, score) VALUES ('b1','s1',1,'structure',4);
    INSERT INTO CaseResult (id, caseType, difficulty, intervieweeId, interviewerId, avgScore, caseId, sessionId) VALUES ('x1','Profitability',1,'u2','u1',4,'k1','s1');
  `);
}

function counts(sql: DatabaseSync) {
  const tables = sql
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations'")
    .all() as Array<{ name: string }>;
  return Object.fromEntries(tables.map(({ name }) => [name, (sql.prepare(`SELECT count(*) AS n FROM "${name}"`).get() as { n: number }).n]));
}

describe("auth/friends/casebank migration on populated data", () => {
  it("keeps every row, backfills tree keys and leaves no half-applied state", () => {
    cpSync(resolve(root, "prisma/schema.prisma"), join(dir, "schema.prisma"));
    cpSync(resolve(root, "prisma/migrations/migration_lock.toml"), join(dir, "migrations/migration_lock.toml"));
    cpSync(resolve(root, `prisma/migrations/${INIT}`), join(dir, `migrations/${INIT}`), { recursive: true });
    deploy();

    let sql = new DatabaseSync(dbFile);
    populateOldSchema(sql);
    const before = counts(sql);
    const keptCaseRefs = sql.prepare("SELECT (SELECT count(*) FROM CaseSession WHERE caseId IS NOT NULL) AS s, (SELECT count(*) FROM CaseResult WHERE caseId IS NOT NULL) AS r").get();
    sql.close();

    cpSync(resolve(root, "prisma/migrations"), join(dir, "migrations"), { recursive: true });
    deploy();

    sql = new DatabaseSync(dbFile);
    const after = counts(sql);
    for (const [table, n] of Object.entries(before)) expect(after[table], table).toBe(n);
    expect(after.FriendRequest).toBe(0);
    expect(after.GroupInvite).toBe(0);
    expect(sql.prepare("SELECT count(*) AS n FROM IssueTreeNode WHERE key <> id").get()).toEqual({ n: 0 });
    expect(sql.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    expect(sql.prepare("SELECT count(*) AS n FROM _prisma_migrations WHERE finished_at IS NULL").get()).toEqual({ n: 0 });
    expect(sql.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name LIKE 'new_%'").get()).toEqual({ n: 0 });
    expect(sql.prepare("SELECT (SELECT count(*) FROM CaseSession WHERE caseId IS NOT NULL) AS s, (SELECT count(*) FROM CaseResult WHERE caseId IS NOT NULL) AS r").get()).toEqual(keptCaseRefs);
    // isAdmin is gone; admin is derived from the Google-verified email now (KTD5).
    const cols = (sql.prepare(`PRAGMA table_info("User")`).all() as Array<{ name: string }>).map((c) => c.name);
    expect(cols).not.toContain("isAdmin");
    expect(cols).toEqual(expect.arrayContaining(["googleSub", "avatarUrl"]));
    sql.close();
  });
});

describe("new uniqueness rules", () => {
  it("lets many users have no username yet, and one open request per pair", async () => {
    const { db, resetAndSeed } = await import("./helpers/db");
    await resetAndSeed();
    await db.user.createMany({
      data: [
        { firstName: "New", lastName: "One", email: "new1@example.com" },
        { firstName: "New", lastName: "Two", email: "new2@example.com" },
      ],
    });
    expect(await db.user.count({ where: { username: null } })).toBe(2);

    const [a, b] = await db.user.findMany({ where: { username: null }, select: { id: true } });
    const pair = [a.id, b.id].sort().join(":");
    await db.friendRequest.create({ data: { fromId: a.id, toId: b.id, openPairKey: pair } });
    await expect(db.friendRequest.create({ data: { fromId: b.id, toId: a.id, openPairKey: pair } })).rejects.toMatchObject({ code: "P2002" });
    // Closed requests clear the key, so any number of them can coexist.
    await db.friendRequest.create({ data: { fromId: b.id, toId: a.id, status: "DECLINED", openPairKey: null } });
    await db.friendRequest.create({ data: { fromId: b.id, toId: a.id, status: "CANCELLED", openPairKey: null } });
    expect(await db.friendRequest.count()).toBe(3);
  });
});
