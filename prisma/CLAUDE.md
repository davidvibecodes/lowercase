# Prisma (schema, migrations, seed)

The stack is Prisma **6.19.3**, pinned, with the classic `prisma-client-js` generator, on SQLite.
- `engineType = "binary"` is deliberate: the Node-API engine has no Windows ARM64 build.
- `DATABASE_URL` paths (`file:./dev.db`) resolve relative to this directory.
- There is no Prisma Studio or other DB tooling in the scripts. Inspect a DB through a copy, never the live `dev.db` while a server runs.

## Schema notes

- **Status and kind columns are plain `String`s**: `CaseSession.status`, `CaseItem.kind`, `IssueTreeNode.status`, the `FriendRequest`/`GroupInvite` statuses, `User.gateMode`. Their allowed values are the `as const` arrays in `src/lib/types.ts`. Validate there; SQLite won't.
- **`User.username`** is `String? @unique`, null until onboarding. SQLite treats NULLs as distinct under UNIQUE, so many users can be un-onboarded.
  - Values are always stored lowercase (`normalizeUsername`), which makes the plain index case-insensitive in practice.
  - Don't switch to a `lower()` expression index: Prisma silently drops it on the next table rebuild.
- **`User.email`** is unique and stored lowercase, written only from verified Google claims or the seed. Admin is derived from it, so there is no `isAdmin` column.
- **`User.googleSub`** is unique and identifies the Google account.
- **"One open request per pair"** uses a nullable unique key that is set only while PENDING: `FriendRequest.openPairKey` and `GroupInvite.openKey`. Prisma on SQLite has no partial unique indexes, and this is the replacement. Keep the invariant whenever you write these tables: key non-null ⇔ `status = "PENDING"`.
- **`IssueTreeNode.key`** is unique per case (`@@unique([caseId, key])`) and stable across tree saves, which delete and recreate the rows. `CaseItem.nodeKey` and `CaseItem.gatePrereqKeys` (a JSON string array; read and write it with `src/lib/node-keys.ts`) hold **keys**, not row ids.
- **Casebank identity.** `Case.externalId` is unique, and `CaseItem` is unique on `(caseId, kind, externalId)`.
  - Hand-authored rows leave `externalId` null.
  - `CaseItem.archivedAt` soft-deletes. `SessionReveal` and `SessionHintUse` reference items, so items with history are never hard-deleted.
- Every relation uses `onDelete: Cascade`, except `CaseSession.case` and `CaseResult`'s session and case links, which use `SetNull`. That makes deleting a `User` or `Case` row far-reaching, so **never drop such a table inside a migration with foreign keys on**.

## Changing the schema (KTD15 in the 2026-10-16 plan)

Prisma does **not** wrap SQLite migrations in a transaction. Its generated table rebuilds (`CREATE TABLE "new_X"` … `INSERT INTO "new_X" SELECT …` … `DROP TABLE "X"`) copy only columns that already exist. A rebuild that adds a `NOT NULL` column without a default passes on an empty test DB and fails half-way on real data. That leaves stray `new_*` tables and a failed `_prisma_migrations` row, after which every `migrate deploy` stops with P3009 and the app can't boot.

Workflow:

1. Edit `schema.prisma`, then run `npx prisma format`.
2. **Never run `prisma migrate dev` against `dev.db`.** It also refuses non-interactive shells. Author the SQL offline instead, against a throwaway shadow DB outside the repo:

   ```bash
   mkdir -p prisma/migrations/<YYYYMMDDHHMMSS>_<name>
   npx prisma migrate diff \
     --from-migrations prisma/migrations \
     --to-schema-datamodel prisma/schema.prisma \
     --shadow-database-url "file:<absolute path to a scratch shadow.db>" \
     --script > prisma/migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql
   ```

3. **Read the SQL.** For every rebuilt table, add hand-written backfills for new required columns. The precedent is `20261016160000_auth_friends_casebank`, which copies `"id"` into `"key"` for `IssueTreeNode`, marked `-- Hand-edited (KTD15)`.
4. **Never wrap it in `BEGIN`/`COMMIT`.** Prisma's `PRAGMA foreign_keys=OFF` around a rebuild only works outside a transaction. Inside one, `DROP TABLE "User"` would cascade-delete rows from every child table.
5. **A migration is frozen once it has been applied to `dev.db`.** `migrate deploy` never re-applies an edited migration. Changes go in a new one.
6. **Regenerate the client with every server stopped** (`npx prisma generate`). `scripts/ensure-db.ts` compares `schema.prisma` with `node_modules/.prisma/client/schema.prisma` and regenerates on any difference, and `tests/unit/seed.test.ts` runs `ensure-db`. A stale client makes that regeneration happen mid-test, which fails with `EPERM` on Windows.
7. **Prove it on data.** Extend `tests/unit/migration.test.ts`. It builds a temp DB at the init migration, fills every child table of `User` plus a tree, a reveal and a hint use through `node:sqlite`, deploys the real migrations, and asserts:
   - row counts in every table are unchanged;
   - the backfills happened;
   - `PRAGMA foreign_key_check` is empty;
   - no `new_*` tables are left;
   - no failed migration rows exist.

   For a risky change, also replay it on a `VACUUM INTO` copy of `dev.db`.

## How migrations reach dev.db (scripts/ensure-db.ts)

`npm run dev`, `npm run start` and `npm run ensure-db` run these steps in order:
1. Write `.env` if missing; add `AUTH_MODE=dev` if absent.
2. Regenerate the client if the schema changed.
3. If migrations are pending **and** the DB already has users, write a consistent backup with `VACUUM INTO prisma/backups/dev-<timestamp>.db`. `VACUUM INTO` includes the WAL; a file copy would not.
4. Run `prisma migrate deploy`. On failure it prints the rollback: stop servers, copy the backup over `prisma/dev.db`, delete `dev.db-wal`/`-shm`, and check out the commit before the migration.
5. Set `journal_mode=WAL`.
6. Seed, in one all-or-nothing transaction, only if `User` is empty.

There is no down-migration. Rollback means restoring the backup.

**Hosted** (`PUBLIC_ORIGIN` set): step 1 is skipped (settings come from the environment, and `.env` is never written), the backup goes to `backups/` beside the database file as `pre-migrate-<timestamp>.db`, and step 6 seeds `seedContent` (learning content only) when there are no concepts. The run stops first if `hostedConfigProblems()` reports anything.

## Seed content (prisma/seed/)

- `users.ts`: the owner (`davidsathyandevice`, the admin email), the friends `roy`, `mihaela` and `ankit` with activity history, 20 league bots (`first.last` usernames, `isLeagueBot: true`), and the study group name.
- `concepts.ts`: concepts, explainer cards and questions.
- `cases/`: `diagnostic-mumbai.ts` is **licensed casebook content**, which is why the repo is private. `additional.ts` holds the 7 practice cases written for this app. Cases share the `CaseSeed` shape from `src/lib/types.ts`.
- `tree.ts`: the `n(label, correct, children)` shorthand and `flattenTree`, which turns a nested spec into keyed rows. Keys are path indexes: the root is `0`, its children `0.0`, `0.1`, and so on.
- `../seed.ts`: the `prisma db seed` entry. It skips a non-empty DB. The logic itself is `seedDatabase` in `src/server/seed-runner.ts`, also used by tests.

Seed edits reach only a fresh database. To see them locally, stop the server, delete `prisma/dev.db*` and start it again. Tests always reseed.

Never commit `*.db`, `*.db-wal`, `*.db-shm` or `backups/`; they are gitignored.
