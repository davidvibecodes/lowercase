# Auth (src/lib/auth)

Authentication, the onboarding gate and admin. Decisions come from `docs/plans/2026-10-16-1510-feat-google-auth-friends-casebank-plan.md`: KTD1–KTD7 and KTD16, and R3–R13.

## The session cookie

`lc_session` = `base64url(userId).method.issuedAtSeconds.hmac`, where:
- `method` is `google` or `dev`;
- the HMAC is SHA-256 keyed with `AUTH_SECRET` (`session-cookie.ts`);
- it lasts 30 days. It is stateless: there is no revocation table (a known residual).

Other properties:
- `secure: false`, because the app is local http only.
- Any change to the format makes every existing cookie fail verification, so everyone signs in again. That is acceptable and was done on purpose when `method` was added.
- `constants.ts` holds only the cookie name, so Edge middleware can import it without `node:crypto`.
- `sign()` / `signatureMatches()` also sign the one-time Google state cookie.

## Admin is computed, in one place

`toSessionUser(user, method)` in `provider.ts` is the **only** place admin is decided. The rule: `isAdmin = method === "google" && isAdminEmail(user.email)`.

- `ADMIN_EMAIL` in `admin.ts` is a code constant on purpose. Env must not be able to widen it.
- The `User.isAdmin` column was dropped. Never reintroduce a stored flag.
- Email is written only from verified Google claims or the seed, and Settings can't edit it. That is what makes the email check sound.
- Every consumer reads `SessionUser.isAdmin`: the guards, TopNav, AccountMenu, `/cms`, the Settings testing controls (gate mode), and the learn page's unpublished-concept preview.

## Guards (guards.ts): which one to use

| Surface | Use | On failure |
|---|---|---|
| Pages under `(app)` / `(focus)` | `requireUser()`; `AppShell` already calls it | redirect `/login`, or `/onboarding/username` when username is null |
| Onboarding page, the check-username API and the claim action | `requireSignedIn()` (username may be null) | redirect `/login` |
| Admin pages | `requireAdmin()`; `(app)/admin/layout.tsx` calls it | redirect `/` (never a 404) |
| Admin server actions | `assertAdmin()` **inside** the action's `run()` try | `ServiceError("Not authorized")` → `{ ok: false, error: "Not authorized" }`, no DB write |
| Admin route handlers | wrap with `adminRoute(handler)` | `403`, before the body is read |
| Other route handlers | `getCurrentUser()`, then check `user.username` yourself | `401` / `403` JSON |

Things that are easy to get wrong:
- **Route handlers skip layouts.** The onboarding gate isn't applied for you; `src/app/api/export/route.ts` shows the explicit check.
- **`adminRoute` adds a CSRF check** for non-GET requests: `Content-Type: application/json` and an `Origin` that exactly equals `http://localhost:PORT` or `http://127.0.0.1:PORT`. Route handlers get none of the Origin protection Next gives server actions.
- **In server actions, call `assertAdmin()` inside `run()`'s try**, so its `ServiceError` becomes `{ ok: false, error: "Not authorized" }`. Outside the try it throws out of the action. Don't use `requireAdmin()` in an action: its redirect would be caught and reported as "Something went wrong". See `src/app/(app)/admin/cases/actions.ts`.
- `getCurrentUser` is wrapped in React `cache()`: one DB read per request.
- `src/middleware.ts` only checks that a cookie exists and redirects to `/login` if not. It is not auth. Everything under `/login*`, `/_next`, `/socket.io` and static assets is exempt, which is why the Google routes live under `/login/google`.
- The Socket.IO handshake (`src/server/realtime/index.ts`) verifies the cookie itself, and rejects with `onboarding_required` when the username is null.

## Google sign-in (google.ts, `src/app/login/google/*`, `src/server/services/google-account.ts`)

- **Library:** `openid-client@6.8.8`, pinned exactly. It uses static Google metadata (no discovery), PKCE S256, `state`, `nonce`, scope `openid email profile` and `prompt=select_account`.
- **The id_token signature is not verified**, because it comes straight from the token endpoint over TLS. `openid-client` still checks iss, aud, exp, nonce and state. This code enforces `email_verified === true` itself.
- **Start (`/login/google`).** If the visitor's Host differs from `GOOGLE_REDIRECT_URI`'s host, they are redirected to the pinned host first, because cookies are per host. The route then sets `lc_oauth`, which holds state, nonce and verifier:
  - HMAC-signed, so another localhost port can't plant one (SameSite ignores ports);
  - path `/login/google`, maxAge 600 s.
- **Callback (`/login/google/callback`).**
  - It rebuilds the callback URL from the pinned redirect URI, never from the Host header.
  - Every outcome clears `lc_oauth`.
  - Failures redirect to `/login?error=<code>`. The codes are `GOOGLE_ERROR_CODES`, and `login-errors.ts` maps each one to fixed text. Unknown codes get a generic line, so a query string can't inject copy. The lookup uses `Object.hasOwn` on purpose.
- **Account resolution (`resolveGoogleUser`):**
  1. Match by `googleSub`, which is unique. Refresh `email`, unless another row owns it, and `avatarUrl`.
  2. Otherwise match by the lowercased verified email, but only a row with `googleSub IS NULL` and not a league bot. Link it with a conditional `updateMany`. A row already linked to a different sub returns `google_conflict`.
  3. Otherwise create a user with `username: null`, which sends them to onboarding.
  4. Two simultaneous first callbacks are resolved by catching P2002 (`isUniqueViolation`) and reading again.
  - Avatars are kept only for `https:` URLs on `*.googleusercontent.com`.
- **Fake IdP.** `fakeIdpBase()` honours `GOOGLE_OIDC_BASE_URL` only when `LC_FAKE_GOOGLE=1` **and** the URL is `http://localhost` or `http://127.0.0.1`. Only then is `allowInsecureRequests` used. `AUTH_MODE=dev` alone must never enable it: because signatures aren't checked, anything answering there could claim the owner's email.
- `googleEnv()` returns null when the keys are missing or still start with `your-`, the `.env.example` placeholders. The UI then shows the "isn't set up yet" message.

## Test login (dev-provider.ts, actions.ts, `src/app/login/as/[username]`)

- Enabled only when `AUTH_MODE=dev`. The cookie it issues has method `dev`, so it is **never admin**.
- It admits only `DEV_LOGIN_USERNAMES` (the owner, `roy`, `mihaela`, `ankit`), each only while its `googleSub` is null. Otherwise anyone at the machine could open a real friend's account by typing their handle.
- `availableDevLogins()` feeds the login page's Testing section.
- **Peer testing.** Cookies are scoped by host, not port, so `localhost:3000` and `127.0.0.1:3000` hold separate sessions. `/login/as/[username]` is opened on the other hostname. It is a page whose button posts a server action. Never turn it back into a GET that signs in: a cross-site link could then replace the owner's Google session.
- `AuthProvider` exposes the `SessionUser` to client components through `useUser()`.

## Loopback guard (`src/server/loopback.ts`)

This protects against DNS rebinding: a hostile hostname that resolves to 127.0.0.1 would pass Next's same-origin checks. There are three call sites:
- `server.ts`: Host must be `localhost:PORT` or `127.0.0.1:PORT`, otherwise `421`.
- Socket.IO `allowRequest`: Host as above. Origin may be absent; when present it must be one of the two origins.
- `adminRoute`: Origin is required and compared exactly.

## Tests

- `tests/unit/auth.test.ts`: cookie format.
- `tests/unit/guards.test.ts`: mocks `next/headers` cookies and `next/navigation` redirect, then drives the real guards.
- `tests/unit/google-routes.test.ts`: the routes against the fake IdP.
- `tests/unit/google-account.test.ts`: account linking.
- `tests/unit/host-allowlist.test.ts`: the loopback guard.
- E2E: `tests/e2e/login.spec.ts`.
