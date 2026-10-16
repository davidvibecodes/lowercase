/**
 * Typed Socket.IO contract shared by server.ts and the browser (U4).
 * Payload drift between the two sides fails `npm run typecheck`.
 */
import type { CaseType, Difficulty, Role, SessionStatus } from "@/lib/types";

export type Ack<T = object> = (res: ({ ok: true } & T) | { ok: false; error: string }) => void;

export type PersonRef = { id: string; firstName: string; lastName: string; username: string; avatarUrl?: string | null };

export type InvitePayload = {
  inviteId: string;
  sessionId: string;
  from: PersonRef;
  caseType: string | null;
  difficulty: number | null;
};

/* ---------- live session projection (U10) ---------- */

export type CaseSummary = { id: string; title: string; caseType: string; difficulty: number };

export type RevealedFact = { id: string; text: string; revealedAt: string };
export type HintView = { id: string; text: string; usedAt: string };

export type InterviewerCaseView = {
  id: string;
  title: string;
  caseType: string;
  difficulty: number;
  problemStatement: string;
  facts: Array<{ id: string; text: string; revealedAt: string | null }>;
  hints: Array<{ id: string; text: string; usedAt: string | null }>;
  recommendations: Array<{ id: string; text: string }>;
  observations: Array<{ id: string; text: string }>;
  transcript: Array<{ id: string; speaker: "interviewer" | "candidate"; text: string }>;
  tree: Array<{ id: string; parentId: string | null; label: string; isCorrectPath: boolean; order: number }>;
};

export type IntervieweeCaseView = {
  id: string;
  title: string;
  caseType: string;
  difficulty: number;
  problemStatement: string;
  revealedFacts: RevealedFact[];
  usedHints: HintView[];
  hintsRemaining: number;
  notepad: string;
};

export type SessionResultView = {
  avgScore: number;
  xp: Record<string, number>;
};

export type SessionView = {
  id: string;
  status: SessionStatus;
  round: number;
  me: PersonRef & { role: Role | null; ready: boolean };
  partner: (PersonRef & { role: Role | null; ready: boolean; connected: boolean }) | null;
  isHost: boolean;
  caseType: CaseType | null;
  difficulty: Difficulty | null;
  selectedCase: CaseSummary | null;
  /** Cases the interviewee may play for the chosen type and level (gated). */
  casePool: CaseSummary[];
  /** True when the chosen level is locked for the interviewee. */
  poolLocked: boolean;
  /** Whose progress gates apply: the interviewee, or the host before roles are set. */
  gateFor: PersonRef | null;
  pendingInvite: { inviteId: string; to: PersonRef } | null;
  hintsUsedCount: number;
  hintsTotal: number;
  interviewer: InterviewerCaseView | null;
  interviewee: IntervieweeCaseView | null;
  result: SessionResultView | null;
  closedBy: string | null;
};

export type ServerToClientEvents = {
  "presence:snapshot": (onlineUserIds: string[]) => void;
  "presence:update": (p: { userId: string; online: boolean }) => void;
  "invite:received": (p: InvitePayload) => void;
  "invite:closed": (p: { inviteId: string; status: "ACCEPTED" | "DECLINED" | "CANCELLED" | "EXPIRED"; by: PersonRef | null }) => void;
  "session:ready": (p: { sessionId: string }) => void;
  "session:state": (view: SessionView) => void;
  "session:closed": (p: { sessionId: string; by: PersonRef | null }) => void;
  "notepad:sync": (p: { sessionId: string; round: number; content: string }) => void;
};

export type SolvePayload = { sessionId: string; scores: Array<{ criterion: string; score: number; notes: string }> };

export type ClientToServerEvents = {
  "invite:send": (p: { toUserId: string; sessionId?: string; caseType?: string; difficulty?: number }, ack: Ack<{ inviteId: string; sessionId: string }>) => void;
  "invite:cancel": (p: { inviteId: string }, ack: Ack) => void;
  "invite:accept": (p: { inviteId: string }, ack: Ack<{ sessionId: string }>) => void;
  "invite:decline": (p: { inviteId: string }, ack: Ack) => void;

  "session:join": (p: { sessionId: string }, ack: Ack<{ view: SessionView }>) => void;
  "session:pickRole": (p: { sessionId: string; role: Role }, ack: Ack) => void;
  "session:setCaseFilter": (p: { sessionId: string; caseType: string; difficulty: number }, ack: Ack) => void;
  "session:selectCase": (p: { sessionId: string; caseId: string | "random" }, ack: Ack) => void;
  "session:ready": (p: { sessionId: string; ready: boolean }, ack: Ack) => void;
  "session:reveal": (p: { sessionId: string; factId: string }, ack: Ack) => void;
  "session:hint": (p: { sessionId: string }, ack: Ack<{ hint: HintView | null }>) => void;
  "session:notepad": (p: { sessionId: string; content: string }, ack: Ack) => void;
  "session:solve": (p: SolvePayload, ack: Ack) => void;
  "session:switchRoles": (p: { sessionId: string }, ack: Ack) => void;
  "session:newCase": (p: { sessionId: string }, ack: Ack) => void;
  "session:close": (p: { sessionId: string }, ack: Ack) => void;
};

export type SocketData = { userId: string; method: "google" | "dev" };
