-- Google sign-in, friend requests, group invites and casebank fields (plan 2026-10-16, U2).
-- Authored with `prisma migrate diff` against a scratch shadow DB; never wrap in a transaction (KTD15).

-- AlterTable
ALTER TABLE "Case" ADD COLUMN "externalId" TEXT;
ALTER TABLE "Case" ADD COLUMN "industry" TEXT;
ALTER TABLE "Case" ADD COLUMN "sourcePages" TEXT;

-- AlterTable
ALTER TABLE "CaseItem" ADD COLUMN "category" TEXT;
ALTER TABLE "CaseItem" ADD COLUMN "externalId" TEXT;
ALTER TABLE "CaseItem" ADD COLUMN "gateAntiLeak" TEXT;
ALTER TABLE "CaseItem" ADD COLUMN "gateNudge" TEXT;
ALTER TABLE "CaseItem" ADD COLUMN "gatePrereqKeys" TEXT;
ALTER TABLE "CaseItem" ADD COLUMN "gateTrigger" TEXT;
ALTER TABLE "CaseItem" ADD COLUMN "nodeKey" TEXT;
ALTER TABLE "CaseItem" ADD COLUMN "sourceTurn" INTEGER;

-- CreateTable
CREATE TABLE "FriendRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "openPairKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    CONSTRAINT "FriendRequest_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FriendRequest_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GroupInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "openKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    CONSTRAINT "GroupInvite_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudyGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupInvite_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupInvite_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_IssueTreeNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "parentId" TEXT,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isCorrectPath" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE_BRANCH',
    "formula" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "IssueTreeNode_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IssueTreeNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "IssueTreeNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
-- Hand-edited (KTD15): existing nodes keep their row id as their stable key.
INSERT INTO "new_IssueTreeNode" ("caseId", "id", "key", "isCorrectPath", "label", "order", "parentId") SELECT "caseId", "id", "id", "isCorrectPath", "label", "order", "parentId" FROM "IssueTreeNode";
DROP TABLE "IssueTreeNode";
ALTER TABLE "new_IssueTreeNode" RENAME TO "IssueTreeNode";
CREATE UNIQUE INDEX "IssueTreeNode_caseId_key_key" ON "IssueTreeNode"("caseId", "key");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "googleSub" TEXT,
    "avatarUrl" TEXT,
    "isLeagueBot" BOOLEAN NOT NULL DEFAULT false,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "gateMode" TEXT NOT NULL DEFAULT 'auto',
    "leagueName" TEXT NOT NULL DEFAULT 'Lithium',
    "soundOn" BOOLEAN NOT NULL DEFAULT true,
    "reducedMotion" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "email", "firstName", "gateMode", "id", "isLeagueBot", "lastName", "leagueName", "reducedMotion", "soundOn", "username", "xp") SELECT "createdAt", "email", "firstName", "gateMode", "id", "isLeagueBot", "lastName", "leagueName", "reducedMotion", "soundOn", "username", "xp" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "FriendRequest_openPairKey_key" ON "FriendRequest"("openPairKey");

-- CreateIndex
CREATE INDEX "FriendRequest_toId_status_idx" ON "FriendRequest"("toId", "status");

-- CreateIndex
CREATE INDEX "FriendRequest_fromId_status_idx" ON "FriendRequest"("fromId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GroupInvite_openKey_key" ON "GroupInvite"("openKey");

-- CreateIndex
CREATE INDEX "GroupInvite_toId_status_idx" ON "GroupInvite"("toId", "status");

-- CreateIndex
CREATE INDEX "GroupInvite_fromId_status_idx" ON "GroupInvite"("fromId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Case_externalId_key" ON "Case"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseItem_caseId_kind_externalId_key" ON "CaseItem"("caseId", "kind", "externalId");

