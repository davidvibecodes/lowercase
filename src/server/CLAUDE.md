# Server (src/server)

Everything that touches the database or sockets.
- `services/`: domain logic, called by pages, server actions, route handlers and socket handlers.
- `realtime/`: Socket.IO.
- `seed-runner.ts`: seeding and the shared tree writer.
- `loopback.ts`: the Host/Origin allowlist. See `src/lib/auth/CLAUDE.md`.

## Service conventions

- **Signature.** `fn(db: Db, actorId, input)`. `Db` is the PrismaClient type, and the process-wide client is `db` from `@/lib/db`.
  - A few functions take a transaction client so they compose inside `$transaction`: `writeTree`, `seedDatabase`, `recordCaseSolved`.
  - Some take an injectable `now` or `rng` for deterministic tests.
- **Untrusted input arrives as `unknown`.** Validate it with `parseInput(zodSchema, value)` (`invites.ts`) or a local `parse` helper. The zod schemas live in `src/lib/types.ts` or next to their feature.
- **`ServiceError`** (`invites.ts`, re-exported by `sessions.ts`) carries a message meant for the user.
  - Server-action wrappers show a `ServiceError`'s message, and turn any other error into "Something went wrong".
  - **Socket handlers show any `Error`'s message** (`errorMessage` in `realtime/types.ts`). Never put internals in an `Error` that a socket path can throw.
- **Unique-index races.** Catch P2002 with `isUniqueViolation(e)` and re-read, rather than check-then-insert.
- **Reading people.** Select `personSelect`, filter users with `onboarded` (`username: { not: null }`), and map through `toPerson()`, so `PersonRef.username` stays a string. League bots (`isLeagueBot`) are excluded from search, requests and Google linking.
- `invites.ts` also hosts these shared helpers: `ServiceError`, `parseInput`, `isUniqueViolation`, `personSelect`, `onboarded`, `toPerson`, `areFriends`, `person`. Import them from there.

## Friends and groups (services/social.ts, KTD8)

- **Friendships and memberships change only through requests and invites.** There is no direct add.
- **Open keys.** `FriendRequest.openPairKey` (the two user ids, sorted and joined) and `GroupInvite.openKey` (`groupId:toId`) are nullable unique columns. The invariant is that the key is non-null **exactly while** status is `PENDING`. That gives "one open request per pair" without partial indexes, which Prisma on SQLite lacks. Two simultaneous opposite requests collide on the key, and the loser takes the accept-the-reverse path.
- **Terminal transitions** (accept, decline, cancel, and a direct join resolving an invite):
  - Each is one conditional `updateMany` that sets the status **and** clears the key.
  - It is scoped to the actor: `toId: me` to respond, `fromId: me` to cancel.
  - It is the first statement in its transaction.
  - `count === 0` means `NO_LONGER_OPEN`.
- **Accepting** upserts **both** directional `Friendship` rows, because `areFriends(db, a, b)` checks one direction.
- **Sending** works by username only, through `findByHandle`. It never takes a user id, because league standings expose ids. A pending reverse request auto-accepts, and a decline is silent.
- **Groups.** `createGroup` makes the owner a member and *invites* the chosen people, and only those who are actually friends. Any group can be joined by name (`joinGroup`), which also resolves a pending invite. Members other than the owner can leave. Group search returns the owner's display name, never a handle.
- **Realtime.** Social changes are pushed from the **action layer**, after the service's transaction has committed (`src/app/(app)/friends/actions.ts`):
  - `notifySocialChanged(db, userIds)` emits `social:changed { received }` to each user's room.
  - `announceNewFriends(a, b)` pushes `presence:update` on accept only, because a pending request must reveal no presence.

## Live sessions (services/sessions.ts, realtime/session.ts)

The state machine:

```
LOBBY --(roles + case + both ready)--> ACTIVE --(solve)--> SOLVED
SOLVED --(switch roles | new case)--> LOBBY (round + 1)
any open state --(close)--> CLOSED
```

- **Every transition** loads the session, asserts the actor is a participant, has the right role and the session is in an allowed status (`assertParticipant`, `assertStatus`), then writes. Reveals, hint uses, notes and rubric scores are keyed by `(sessionId, round, …)`.
- **Gating.** The case pool comes from the interviewee's progress gates, or the host's before roles are picked (`gateUserId`, `src/lib/rules/gates.ts`). `gateMode` (`auto | forceUnlocked | forceLocked`) is an admin testing override.
- **`buildView(db, sessionId, viewerId, connected)` is the role projection**, and a security boundary:
  - It loads the transcript and tree only for the interviewer.
  - The interviewee object carries only revealed facts, used hints, the hints-remaining count and their own notepad.
  - Reveal guidance (category, node, prerequisite labels, trigger, anti-leak, nudge), recommendations, observations and `given` facts appear only in `interviewer`.
  - Node keys are resolved to labels. A missing key shows as "(removed node)".
  - Hint counts include only uses of *active* hints, because a re-import can archive one.
- **Socket handlers** (`realtime/session.ts`) go through `handle()`: run the service, ack, then `broadcastSession(io, sessionId)`. The broadcast keeps a per-session queue: one snapshot pass at a time, and requests that arrive mid-pass coalesce into one more pass. Each socket in the room gets the view built for its own user.
- **Session invites** (`realtime/invites.ts`, `services/invites.ts`) expire through an in-memory `setTimeout` (`INVITE_TTL_MS`, default 120 s). A server restart loses pending timers, which is a known residual.
  - You can invite only an online friend.
  - Inviting from an existing lobby (`sessionId`) cancels that lobby's older pending invite, because a lobby holds one open invite.
- **Presence** (`realtime/presence.ts`) is an in-memory map from userId to socket ids on `globalThis`. `AppShell` reads it for first paint, and the handshake emits `presence:snapshot` (online friends only).

## Socket server (realtime/index.ts)

- `allowRequest` checks the Host and Origin allowlist.
- The `io.use` middleware verifies the `lc_session` cookie from the handshake headers, and rejects users with no username (`onboarding_required`).
- Each socket joins `user:<id>`. Session sockets also join `session:<id>` on `session:join`.
- `setIo(io)` publishes the instance for server actions. Use `getIo()` and treat `null` as "no socket server", for example in unit tests.
- The event contract is typed in `src/lib/realtime/events.ts`. Changing a payload means changing that file, and `npm run typecheck` catches both sides.

## Cases, the CMS and the casebank

- **Tree writes.** `writeTree(tx, caseId, nodes)` in `seed-runner.ts` is shared by the seed, the CMS (`admin-cases.ts` `saveTree`) and the importer.
  - It inserts parent-first by `parentKey` and throws if a node's parent never resolves.
  - A tree save **deletes and recreates** the rows, so ids change and keys don't. Anything that references a node must use `key`.
- **`saveTree` runs `validateTree(nodes, refs)`** (`src/lib/rules/tree.ts`).
  - It rejects: empty or duplicate keys, a tree without exactly one root, empty labels, missing parents and cycles.
  - It also refuses a tree that drops a key a live fact or recommendation still references, and the message names the item.
  - A broken correct path is only a warning, so it doesn't block the save.
- **`saveCaseItems(db, caseId, kind, items)`** saves one ordered list by diffing ids. Edits update in place, new items insert, and removed items are archived.
  - Facts save category, `nodeKey` and the gate fields. Recommendations save category and `nodeKey` (their target).
  - Every referenced node key must exist in the case's tree.
- **`deleteCase`** refuses while a LOBBY, ACTIVE or SOLVED session uses the case; unpublish it instead. Items with reveal or hint history are archived (`archivedAt`), never hard-deleted.
- **`importCasebank(db, doc, { dryRun })`** (`casebank.ts`):
  1. `planCasebank` (`src/lib/casebank.ts`) validates the whole file first: the zod schema, id patterns, length limits, and every cross-reference checked with `Map`/`Set` so `constructor` can't pass as an id.
  2. `previewAll` reports create or update and the blocked state per case. A dry run stops here.
  3. Each case is then its own interactive transaction (`timeout: 60_000`):
     - Upsert the case on `externalId` (the casebank `case_id`).
     - Replace the tree and the transcript.
     - Upsert items on `(caseId, kind, externalId)` and clear their `archivedAt`.
     - Archive items of imported kinds that are missing from the file, including CMS-added ones.
     - Imported cases are published.
  - A case with an ACTIVE session is refused, checked again inside the transaction.
  - One failed case doesn't roll back the others, and a re-run converges.
  - Hints are derived from correct-path nudges and keyed `hint:<nodeKey>` (KTD13).
  - The importer owns exactly `IMPORTED_KINDS`. A kind added later isn't archived by re-imports.

## Seeding (seed-runner.ts)

`seedDatabase(tx, now)` builds the full seed state:
- concepts and questions;
- the cases, including the Mumbai case;
- the owner and three friends (`roy`, `mihaela`, `ankit`) with history, all mutual friends;
- 20 league bots named `first.last` (e.g. `priya.n`). A test username can collide with them.
- one study group, "Case Club Squad".

It is called inside one transaction by `scripts/ensure-db.ts` and `prisma/seed.ts`, and directly by the test helper `resetAndSeed()`. `resetUserProgress` backs Settings → Reset all my progress.

`seedContent(tx)` is the **hosted** seed: concepts plus every case, with no users, friendships or groups. `ensure-db` uses it when `PUBLIC_ORIGIN` is set, and only while there are no concepts. A hosted `resetUserProgress` never treats a user as a seeded person.

## Backups (backup.ts, db-file.ts)

Hosted only: `startBackups()` (called from `server.ts`) writes `lowercase-<timestamp>.db` with `VACUUM INTO` a minute after start and then daily, into `backups/` beside the database file, and prunes to the newest 7. `db-file.ts` turns a `DATABASE_URL` into that path (relative paths resolve from `prisma/`, like Prisma). The pre-migration backup in `ensure-db` uses the same folder when hosted.
