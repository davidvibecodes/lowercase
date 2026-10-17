# lowercase

Gamified, peer-to-peer consulting case prep. Learn frameworks through adaptive quizzes, then run live Interviewer/Interviewee cases with a friend, with revealable facts, hints, a blue/grey issue tree, a transcript and a rubric.

## Run it

```bash
npm install
npm run dev
```

On the first run, `scripts/ensure-db.ts` writes `.env` (a random `AUTH_SECRET` and `AUTH_MODE=dev`), applies migrations and seeds `prisma/dev.db`. Open http://localhost:3000 and click **Continue with Google** (set it up first, see below). Before Google is set up, the **Testing** section signs you in as a seeded account without admin.

Before it applies new migrations to a database that has users, `ensure-db` saves a copy to `prisma/backups/`. If a migration ever fails, stop every server, copy the newest backup over `prisma/dev.db`, delete `prisma/dev.db-wal` and `prisma/dev.db-shm`, and check out the commit before the new migration.

For the production build:

```bash
npm run build
npm run start
```

The server listens on loopback only (`127.0.0.1:3000`) and answers only to `localhost` and `127.0.0.1`, so the passwordless test login can't be reached from your network or from a page on another hostname.

To put it online, see [docs/hosting.md](docs/hosting.md). Setting `PUBLIC_ORIGIN` switches on hosted mode: it pins to the public address, uses Secure cookies, turns the test login off and seeds learning content only. A `Dockerfile`, `railway.json` and `deploy/vm/` (Caddy + Docker Compose for a free VM) are included.

## Google sign-in

Everyone signs in with **Continue with Google**. Until a Google client is configured, the button explains what's missing, and the local test login still works.

1. In [Google Cloud Console](https://console.cloud.google.com/), open **Google Auth Platform**.
2. **Branding**: set an app name and support email.
3. **Audience**: choose **External** and leave the app in **Testing**. Under **Test users**, add your Google address and each friend's before they sign in (up to 100). Apps that ask only for `openid email profile` need no verification.
4. **Clients → Create client → Web application**. Add both authorized redirect URIs:
   - `http://localhost:3000/login/google/callback`
   - `http://127.0.0.1:3000/login/google/callback`
5. Copy the client ID and secret into `.env` as `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_REDIRECT_URI` (see `.env.example`). Google shows the secret only once.

Google deletes an OAuth client that has no sign-ins for 6 months. If sign-in suddenly fails with a setup error, check the client still exists.

The admin CMS opens only for a Google session on `davidsathyandevice@gmail.com`. The local test login never grants admin, and it stops offering an account once that account has signed in with Google.

New accounts choose a unique username before they can use the app. Usernames are 3–20 characters (a–z, digits, dots and underscores, starting with a letter), compared without case, and can't be changed later.

### Practising with a friend at your computer

The app runs on your machine only. A friend signs in with their own Google account in a **private window**, and closes it after the session, never in your browser profile. Google sign-in uses one host, so two Google users need separate cookie jars, and a shared profile would offer your admin Google account in the account chooser.

## Two users in one browser (testing)

Cookies are scoped by host, not port, so `localhost:3000` and `127.0.0.1:3000` hold separate sessions. On the login page, **Open as Online Friend / Peer Tester** opens Roy C, Mihaela D or Ankit S on the other hostname in a new tab, where one click signs them in with the test login. Both tabs stay signed in, and invites, presence and live sessions work between them.

## Friends & Groups

There's no list of everyone who signed up. Find people by their **exact** username in **Search**, then send a friend request; they accept or decline it under **Received**, and you can cancel it under **Sent**. Start Session works between accepted friends who are online. Groups are found by name; creating a group sends invites to the friends you pick.

## Importing a casebank

Admin → Cases → **Import casebank** takes a schema 2.0.0 casebank JSON file. You see a preview (cases to create or update, with counts) before anything is saved, then each case's result. Importing the same file again updates those cases in place and keeps session history; it overwrites CMS edits to imported items. A case with a session in progress is skipped. In a live session the interviewer sees each fact's reveal guidance (when to reveal, what to cover first, what not to leak, and a nudge if the candidate skips it). The candidate never sees it. Keep casebank files out of git, for example in the ignored `content/private/` folder.

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

## Content note and repository visibility

**Keep this repository private.** The "Diagnostic Center – Mumbai" case and transcript come from the Consult Club, IIM Ahmedabad casebook ("not to be shared without permission"). They are seeded for local personal use only. A hosted deployment seeds only the cases written for this app and leaves the Mumbai case out, but its text is still in the source, so replace or license that content before making the repository or an image public. The other quiz questions and practice cases were written for this app and should get a human review for accuracy. Casebank JSON files you import through the CMS stay outside git. Keep them in the ignored `content/private/` folder or anywhere else on your machine.
