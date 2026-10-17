# App routes (src/app)

Next.js 15 App Router. Pages are async server components. They read data by calling services in `src/server/services` with `db` from `@/lib/db`; there is no internal REST API for page data. Signed-in pages are per-user and use `export const dynamic = "force-dynamic"`, either in their layout or in the route file.

## Route map

| Path | Group / guard | Notes |
|---|---|---|
| `/login` | public (middleware-exempt) | "Continue with Google", plus the Testing section when `AUTH_MODE=dev`. `?error=<code>` is rendered through `loginErrorMessage()` only. |
| `/login/google`, `/login/google/callback` | public route handlers | OIDC start and callback. They live under `/login` so cookie-less visitors pass the middleware. |
| `/login/as/[username]` | public page | Peer-tester test login, opened on the other loopback host. It signs in only through its POST server action. |
| `/onboarding/username` | `requireSignedIn()`, **outside** `AppShell` | `AppShell` calls `requireUser()`, which would redirect this page to itself |
| `(app)/…` (`/`, `/learn`, `/friends`, `/you`, `/settings`) | `AppShell` → `requireUser()` | With the top nav |
| `(app)/admin/…` | `admin/layout.tsx` → `requireAdmin()` | Non-admins are redirected home, never 404. Every admin action also calls `assertAdmin()`. |
| `(focus)/learn/[conceptId]`, `(focus)/session/[id]` | `AppShell nav={false}` | Full-screen lesson and live session. The session page renders only for its two participants. |
| `/cms` | `requireUser()` | Alias: admins go to `/admin`, everyone else to `/` |
| `/api/users/check-username` | `getCurrentUser()` | Works before onboarding (R9). Returns 401 when signed out. |
| `/api/export` | `getCurrentUser()` plus an explicit username check | Route handlers skip layouts, so the onboarding gate is checked by hand |
| `/api/admin/casebank` | `adminRoute()` | POST JSON `{ document, dryRun }`. `dryRun` defaults to true unless it is explicitly `false`. The streamed body is capped at `CASEBANK_MAX_BYTES` (2 MB, 413 above it), with `Content-Length` checked first. Responses: 400 for bad JSON, 422 for a file that fails validation. |

`AppShell` (`src/components/shell/AppShell.tsx`) is the signed-in chrome. Per request it loads the user, XP and streak, the friends who are online right now (from the presence registry), the sound and reduced-motion preferences, and the Received count. It then mounts the client bridges: `AuthProvider`, `RealtimeBridge`, `SoundPrefsSync`, `GamificationHydrator`, `InviteListener` and `ReducedMotionFlag`. Data every signed-in page needs belongs here; page-specific data belongs in the page.

## Server actions

Each feature keeps its actions in a sibling `actions.ts` (`"use server"`), with a **local `run()` wrapper**:

```ts
async function run<T extends object>(fn: () => Promise<T | void>): Promise<Result<T>> {
  try {
    await assertAdmin();                       // admin actions: inside the try (R13)
    const out = (await fn()) ?? ({} as T);
    revalidatePath("/admin/cases", "layout");  // whatever the change affects
    return { ok: true, ...out };
  } catch (e) {
    return { ok: false, error: e instanceof ServiceError ? e.message : "Something went wrong" };
  }
}
```

- **Return a result; never throw to the client.** Callers branch on `ok` and toast `error`.
- **Auth:**
  - User actions call `requireUser()`. Most do it before `run()`; friends' `run()` calls it first.
  - Admin actions call `assertAdmin()` inside the try, so a non-admin gets `{ ok: false, error: "Not authorized" }` and nothing is written.
  - Onboarding uses `requireSignedIn()`.
- **Input is `unknown`.** Validate it in the service (zod), not in the action.
- **Revalidation.** Use `revalidatePath("/", "layout")` when the shell changes: XP, streak, the Received badge, preferences. Use narrower paths for CMS edits.
- **Realtime side effects run after the service call returns**, i.e. after commit, and only through `src/server/realtime/social.ts` helpers or `getIo()`. Example: `friends/actions.ts` calls `notifySocialChanged` / `announceNewFriends`.
- **Lesson completion** (`(focus)/learn/[conceptId]/actions.ts`) recomputes correctness server-side from the submitted attempts. Never trust a client-sent score.
- Server actions get Next's built-in Origin check. Route handlers don't, which is why admin route handlers go through `adminRoute()`.

## Route handlers

- Add `export const dynamic = "force-dynamic"`.
- Authorize first:
  - `getCurrentUser()` plus a `username` check for user endpoints;
  - `adminRoute(handler)` for admin endpoints. It gives a 403 before the body is read, requires a JSON content type, and requires an exact loopback `Origin` on non-GET requests.
- Respond with `NextResponse.json`. Cap request bodies explicitly; route handlers have no default limit. `api/admin/casebank/route.ts` shows a streaming size cap.

## Privacy rules that bind every page

These are product requirements:
- Never render a list of users the viewer hasn't friended.
- People search is exact-handle only.
- League rows show name and XP, never a username.
- Group search shows the owner's display name only.
- A friend request is sent by username, never by user id.

Admin UI is hidden for non-admins (`user.isAdmin` from `useUser()`, or the server-side `SessionUser`). Hiding is cosmetic, though: the server guards are the enforcement.
