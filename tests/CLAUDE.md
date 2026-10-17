# Tests

There are two suites: Vitest 5 for rules, services, route handlers, guards and sockets, and Playwright 1.64 for end-to-end flows. Neither ever touches `prisma/dev.db` or real Google.

## Unit and service tests (tests/unit, `npm test`)

- **Config** (`vitest.config.ts`):
  - It picks up `tests/unit/**/*.test.ts` in a `node` environment.
  - The `@` alias points at `src`.
  - The env is `DATABASE_URL=file:./test.db`, `AUTH_SECRET=unit-test-secret`, `AUTH_MODE=dev`.
  - Timeouts: 30 s per test, 60 s per hook.
- **`fileParallelism: false`.** Every file shares the single `prisma/test.db`, so files run one after another. Don't enable parallelism or rely on one file's data in another.
- **`global-setup.ts`** deletes `prisma/test.db*` and runs `prisma migrate deploy` once per run. The test DB therefore always reflects the committed migrations, not `db push`.
- **Seed state.** `helpers/db.ts` provides `resetAndSeed(now?)` and `userId(username)`:
  - `resetAndSeed` empties every table with foreign keys off, then runs the real `seedDatabase`. Call it in `beforeEach` or `beforeAll`.
  - `userId` looks up seeded accounts: `davidsathyandevice`, `roy`, `mihaela`, `ankit`, or bots like `priya.n`.
- **Services are tested directly** against the real `db`: `import { db } from "./helpers/db"`, then `await social.sendFriendRequest(db, …)`. Pure rules live in `tests/unit/rules/*`.
- **Server actions, route handlers and guards** are imported and called for real, after mocking only Next's request APIs:

  ```ts
  vi.mock("server-only", () => ({}));
  vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
  vi.mock("next/navigation", () => ({ redirect: (u: string) => { throw new Error(`redirect:${u}`); } }));
  vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "lc_session" && cookieValue ? { name: n, value: cookieValue } : undefined) }) }));
  const guards = await import("@/lib/auth/guards"); // import after the mocks
  ```

  Set `cookieValue = createSessionValue(userId, "google" | "dev")` to act as someone. A `"google"` cookie on the owner's account is the admin case. Route handlers take a `NextRequest` built directly. See `guards.test.ts`, `admin-actions.test.ts`, `casebank-route.test.ts` and `check-username-route.test.ts`.
- **Sockets.** `helpers/realtime.ts` runs the real `attachRealtime` on an ephemeral port:
  - `startHarness()` returns `{ url, io, http, clients, close }`.
  - `connectAs(h, userId, before?, extraHeaders?)` builds a dev-method session cookie.
  - `nextEvent(client, "event")` waits for an event, with a timeout.
  - `call(client, "event", payload)` resolves the ack.

  Always `await h.close()`. Presence is cleared per harness. Server actions under test see `getIo()` only after a harness has set it.
- **Google.** `tests/helpers/fake-google.ts` (`startFakeGoogle()`) is a `node:http` IdP shared with E2E:
  - It serves `GET /authorize` and `POST /token`, and `POST /__persona` chooses who signs in next. `/certs` is never fetched, because signatures aren't checked.
  - It checks PKCE, echoes the nonce, and issues an RS256-shaped id_token with a junk signature, which is fine because token-endpoint tokens aren't signature-checked.
  - Tests opt in per run with `LC_FAKE_GOOGLE=1` and `GOOGLE_OIDC_BASE_URL=<fake.baseUrl>`, as `google-routes.test.ts` shows.
- **Migrations.** `migration.test.ts` replays the real migration files on a temporary database populated through `node:sqlite` at the init schema. Extend it whenever a migration rebuilds a table; see `prisma/CLAUDE.md`.
- **`seed.test.ts`** runs `scripts/ensure-db.ts` twice in a subprocess. With servers running on Windows, or with a stale Prisma client, it can hit `EPERM` while regenerating.

## End-to-end (tests/e2e, `npm run test:e2e`)

- **`npm run test:e2e` builds first.** The Playwright `webServer` serves the **production build** in `.next`. To run one spec: `npm run build`, then `npx playwright test tests/e2e/<name>.spec.ts`.
- **Server.** `scripts/e2e-server.ts`:
  1. Deletes `prisma/e2e.db*`.
  2. Sets `DATABASE_URL=file:./e2e.db`, `PORT=3100`, `AUTH_MODE=dev` and `INVITE_TTL_MS=120000`.
  3. Starts the fake IdP on port **3199** and points the Google env vars at it.
  4. Runs `ensure-db`, then imports `server.ts`.

  `reuseExistingServer` is false, so ports 3100 and 3199 must be free.
- **Execution.** One Chromium worker, `fullyParallel: false`. All specs share one `e2e.db` for the whole run, so a spec must not depend on another's leftovers. Use fresh personas and usernames, and avoid the seeded handles, including bot handles like `priya.n`.
- **Helpers** (`helpers.ts`):

  | Helper | What it does |
  |---|---|
  | `setGooglePersona(p)` | Chooses who the fake IdP signs in next |
  | `loginGoogle(browser, persona)` | Clicks "Continue with Google" on `http://localhost:3100` |
  | `loginOwner(browser)` | Google sign-in as the admin email |
  | `loginNewcomer(browser, persona, username)` | Google sign-in plus the onboarding step |
  | `loginPeer(browser, username)` | Test login for a seeded friend on `http://127.0.0.1:3100`, through the POST page `/login/as/<username>` |
  | `waitOnline(page)` | Waits for the socket to connect |

  Two-person flows use one context per host, because cookies are per host.
- **Assertions.**
  - Next's route announcer also has `role="alert"`, so scope alert checks, e.g. `page.getByRole("alert").filter({ hasText: "…" })`.
  - Prefer role and label locators. The UI text for onboarding, friends and errors is asserted verbatim (e.g. "✓ Username is available"), so changing copy means updating specs.
- Specs:
  - `login`, `onboarding`, `friends`, `settings`;
  - `admin`: the CMS, plus casebank import of `tests/fixtures/casebank-sample.json`, which is original content;
  - `learn`;
  - `full-flow`: two players run a live case, switch roles, and the result unlocks Level 2;
  - `perf`: option select and Check feedback must commit in under 50 ms.

## Windows

Stop the dev or production server before `npm run test:e2e`. The build step runs `prisma generate`, which can't replace the query engine while another Node process holds it (`EPERM`). The unit suite can run alongside a dev server, because it uses its own `test.db`, but not alongside a `prisma generate`.
