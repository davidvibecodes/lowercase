# Code review residuals — 2026-10-15

Review run `20261015-154835-0f67b608` (verdict: Ready with fixes). Every confirmed correctness, security and test-gap finding was applied in the `fix(review)` commit. The items below were deliberately left open.

## Deferred: acceptable for the local dev-auth MVP, revisit before real auth

- **Stateless session cookie.** `lc_session` is an HMAC-signed user id with no server-side revocation. Logging out clears the cookie, but a copied value stays valid until `AUTH_SECRET` rotates. When real auth replaces `DevLoginProvider`, add a session table (or token version) so that sessions can be revoked.
- **No Origin check on the Socket.IO handshake.** The server binds to 127.0.0.1 and the cookie is SameSite=Lax, so the cross-site socket risk is local only. Add an `allowRequest` Origin allowlist before exposing the server beyond loopback.
- **`isCorrect` reaches the client with each question.** A learner could read answers from devtools. Grading, mastery and XP are already server-side, so only self-deception is possible. Move grading of the reveal to the server if leaderboards ever matter.
- **Lesson-completion XP action can be replayed.** A crafted repeat call to the completion action can award XP again. Fix: issue a one-time lesson token when the lesson starts and consume it on completion.
- **Invite expiry timers live in memory.** If the server restarts while an invite is pending, that invite stays PENDING and can still be accepted later, as long as its lobby is open. Fix: at startup, expire PENDING invites older than the TTL, and have accept check the invite's age.

## Maintainability refactors (no behaviour change, not applied)

- Move `ServiceError` and the error-to-message mapping into a shared `errors.ts` module.
- Pull the case write paths (items, transcript, tree) out of `admin-cases.ts` into a `case-writes` module.
- Name the realtime payload types (`Payload<"session:reveal">`) instead of inlining them.
- Add a `runAction` helper for the repeated try/`requireAdmin`/revalidate pattern in server actions, and an `ackHandler` helper for socket handlers.
- Add a shared `PersonRef` type for the `{ id, firstName, lastName }` shape used across views.

## Manual follow-up

- #16: re-check the "Your friend joined" modal across two real browser tabs while a lesson is in progress. A unit test covers the server path; the modal UX was not exercised in Playwright.
