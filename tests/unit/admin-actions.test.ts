import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionValue } from "@/lib/auth/session-cookie";
import { db, resetAndSeed, userId } from "./helpers/db";

// Drive the real guards: only the request cookie and Next's cache/runtime hooks are faked.
let cookieValue: string | undefined;
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "lc_session" && cookieValue ? { name, value: cookieValue } : undefined) }),
}));

const concepts = await import("@/app/(app)/admin/concepts/actions");
const cases = await import("@/app/(app)/admin/cases/actions");
const settings = await import("@/app/(app)/settings/actions");

describe("admin server actions refuse non-admins", () => {
  let conceptId: string, caseId: string, roy: string, david: string;
  beforeAll(async () => {
    await resetAndSeed();
    [roy, david] = [await userId("roy"), await userId("davidsathyandevice")];
    conceptId = (await db.concept.findFirstOrThrow()).id;
    caseId = (await db.case.findFirstOrThrow()).id;
  });
  beforeEach(() => {
    cookieValue = createSessionValue(roy);
  });

  const calls = () =>
    [
      ["createConcept", () => concepts.createConceptAction({ slug: "hack", title: "Hack", summary: "x", icon: "sparkles", published: true })],
      ["updateConcept", () => concepts.updateConceptAction(conceptId, { slug: "hack", title: "Hack", summary: "x", icon: "sparkles", published: true })],
      ["moveConcept", () => concepts.moveConceptAction(conceptId, 1)],
      ["publishConcept", () => concepts.publishConceptAction(conceptId, false)],
      ["deleteConcept", () => concepts.deleteConceptAction(conceptId)],
      ["saveExplainers", () => concepts.saveExplainersAction(conceptId, [])],
      ["saveQuestion", () => concepts.saveQuestionAction(conceptId, null, {})],
      ["deleteQuestion", () => concepts.deleteQuestionAction("q")],
      ["resetConceptMastery", () => concepts.resetConceptMasteryAction(conceptId)],
      ["createCase", () => cases.createCaseAction({})],
      ["updateCaseMeta", () => cases.updateCaseMetaAction(caseId, {})],
      ["saveCaseItems", () => cases.saveCaseItemsAction(caseId, "fact", [])],
      ["saveTranscript", () => cases.saveTranscriptAction(caseId, [])],
      ["saveTree", () => cases.saveTreeAction(caseId, [])],
      ["deleteCase", () => cases.deleteCaseAction(caseId)],
      ["setGateMode", () => settings.setGateModeAction("forceUnlocked")],
    ] as const;

  it("rejects every admin action for a signed-in non-admin and changes nothing", async () => {
    const before = { concepts: await db.concept.count(), cases: await db.case.count(), explainers: await db.explainerCard.count(), nodes: await db.issueTreeNode.count() };
    for (const [name, call] of calls()) await expect(call(), name).rejects.toThrow("Not authorized");
    expect({ concepts: await db.concept.count(), cases: await db.case.count(), explainers: await db.explainerCard.count(), nodes: await db.issueTreeNode.count() }).toEqual(before);
    expect((await db.user.findUniqueOrThrow({ where: { id: roy } })).gateMode).toBe("auto");
  });

  it("rejects them when signed out too", async () => {
    cookieValue = undefined;
    await expect(concepts.deleteConceptAction(conceptId)).rejects.toThrow("Not authorized");
  });

  it("lets the admin through", async () => {
    cookieValue = createSessionValue(david);
    const r = await concepts.publishConceptAction(conceptId, true);
    expect(r).toEqual({ ok: true });
  });
});
