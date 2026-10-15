# lowercase

Gamified, peer-to-peer consulting case prep. Learn frameworks through adaptive quizzes, then run live Interviewer/Interviewee cases with a friend, with revealable facts, hints, a blue/grey issue tree, a transcript and a rubric.

## Run it

```bash
npm install
npm run dev
```

On the first run, `scripts/ensure-db.ts` writes `.env` (a random `AUTH_SECRET` and `AUTH_MODE=dev`), applies migrations and seeds `prisma/dev.db`. Open http://localhost:3000 and click **Continue as davidsathyandevice (User + Admin)**.

For the production build:

```bash
npm run build
npm run start
```

The server listens on loopback only (`127.0.0.1:3000`), so the passwordless test login can't be reached from your network.

## Two users in one browser

Cookies are scoped by host, not port, so `localhost:3000` and `127.0.0.1:3000` hold separate sessions. On the login page, **Open as Online Friend / Peer Tester** opens Roy C, Mihaela D or Ankit S on the other hostname in a new tab. Both tabs stay signed in, and invites, presence and live sessions work between them. An incognito window also works.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Bootstrap the DB, then run Next.js + Socket.IO (custom `server.ts`) with hot reload |
| `npm run build` | Generate the Prisma client and build Next.js |
| `npm run start` | Bootstrap the DB, then serve the production build |
| `npm run typecheck` / `npm run lint` | TypeScript strict / ESLint |
| `npm test` | Vitest unit and service tests against `prisma/test.db` |
| `npm run test:e2e` | Playwright against an isolated server on port 3100 with a fresh `prisma/e2e.db` |

On Windows, stop any running dev or E2E server before `npm run build`: `prisma generate` can't replace the engine while a Node process holds it.

## Resetting data

- Settings → **Reset quiz mastery** or **Reset all my progress** (back to seed state).
- Admin → Overview → **Reset mastery** for one concept, for every learner.
- Or stop the server, delete `prisma/dev.db*`, and start it again for a full reseed.

## Architecture in brief

- **Next.js 15 App Router** with a custom `server.ts` that also hosts **Socket.IO** on the same port (presence, invites, live sessions).
- **Prisma 6 + SQLite** as the single source of truth. The binary query engine is used because the Node-API engine has no Windows ARM64 build.
- The server sends each player a role-specific session snapshot. The interviewee never receives unrevealed facts, unused hints, the tree, the transcript or the rubric.
- Auth sits behind an `AuthProvider` seam in `src/lib/auth/`. The dev provider only works with `AUTH_MODE=dev`, so email or OAuth can replace it without UI changes.

## Content note

The "Diagnostic Center – Mumbai" case and transcript come from the Consult Club, IIM Ahmedabad casebook ("not to be shared without permission"). They are seeded for local personal use only. Replace or license that content before any public deployment. The other quiz questions and practice cases were written for this app and should get a human review for accuracy.
