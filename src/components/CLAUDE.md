# UI (src/components, src/stores, client parts of src/lib)

React 19 client components, styled with Tailwind CSS v4 and animated with Framer Motion. The app is dark-only.

## State and data flow on the client

- **Server data arrives as props** from server components. Small "bridge" components in `components/shell/` copy the first-paint values into **zustand** stores (`src/stores/*`), and sockets keep the stores live:

  | Bridge | Store | Kept live by |
  |---|---|---|
  | `GamificationHydrator` | `useGamification` (XP, streak) | lesson and session results |
  | `RealtimeBridge` | `usePresence` (connection status, online friends) and `useSocial` (Received badge) | `presence:*` and `social:changed`; on `social:changed` it calls `router.refresh()` only on `/` and `/friends` |
  | `SoundPrefsSync` | `useSound` | `hydrateSound()` from the account value, plus the `storage` event from other tabs |
  | `InviteListener` | local state, plus `useActivity` | `invite:*` and `session:ready`. It holds a ready prompt while a lesson is in progress. |

- **Live sessions.** `useSessionStore` mirrors the server's `SessionView`. Only `session:state` snapshots write it. Never update it optimistically, because the server decides what each role may see.
- **The signed-in user.** Call `useUser()` (`@/lib/auth/AuthProvider`); never read cookies. `user.isAdmin` only decides what to *show*.
- **Mutations** call server actions and branch on the result: `const r = await someAction(…); toast(r.ok ? "Done" : r.error, r.ok ? "success" : "warning")`. Wrap them in `useTransition` for busy states.

## Realtime client (src/lib/realtime)

- `getSocket()` returns the tab's single Socket.IO client: websocket transport, authenticated by the httpOnly cookie, auto-reconnecting.
- Emit with `emitAck(event, payload)`. It always resolves, either with the server's ack or with `{ ok: false, error: "Connection lost. Try again." }` after 8 s, so busy states always clear.
- Event names and payloads are typed in `events.ts`. Use them; don't cast.
- A disconnected socket misses `social:changed`. The badge is re-seeded only by the next server render of `AppShell`.

## Patterns already in use

- **Debounced lookups drop stale responses** with a sequence ref. Bump `seq.current` per request and ignore any reply whose number is no longer current. Used in `onboarding/UsernameForm.tsx` (300 ms, R9), `friends/SearchPanel.tsx` and `friends/GroupsPanel.tsx`. Copy this for any new as-you-type lookup.
- **Sound** goes only through `play(name)` from `@/lib/sound`. It checks the preference at play time and swallows autoplay refusals. Don't create `Audio` or `AudioContext` elsewhere. Toggle the setting with `setSoundPreference(on, save)` (`@/stores/sound`), which flips optimistically, reverts on a failed save, and mirrors to `localStorage` under `lc:sound:<userId>`.
- **Toasts.** `toast(message, tone?)` from `components/ui/Toast.tsx`. The `<Toaster />` is mounted once in the root layout.
- **Primitives** live in `components/ui/`: `Button`, `Card`, `Modal`, `SlideOver`, `Tabs`, `Pill`, `ProgressBar`, `Ring`, `Markdown`, `Toast`. Use them before adding new ones.
- **`Markdown`** renders authored concept and lesson content. Casebank-imported text (facts, guidance, transcript) renders as plain text.
- **Avatars.** `home/Avatar.tsx` shows the Google photo and falls back to initials on error. Only `*.googleusercontent.com` URLs are ever stored.

## Styling

- **Tailwind v4, CSS-first.** Design tokens are `@theme` variables in `src/app/globals.css`, and Tailwind exposes them as utilities:
  - surfaces: `bg-obsidian` (page), `bg-surface`, `bg-surface-2`, `bg-surface-3`;
  - borders: `border-line`, `border-line-strong`;
  - text: `text-ink`, `text-muted`, `text-faint`;
  - accents: `emerald` (success, correct), `royal` / `royal-bright` (primary, correct-path nodes), `amber` (warnings, the selected node, root cause), each with a `*-soft` tint;
  - other tokens: `--radius-card`, `--shadow-glow-emerald`, `--shadow-glow-amber`, `--shadow-press`.

  Use tokens rather than raw hex values. There is no `tailwind.config` file.
- **Font.** Plus Jakarta Sans via `next/font` (`--font-jakarta`).
- **Motion.** The root `MotionProvider` wraps the app in `LazyMotion features={domAnimation} strict`. Animate with the **`m`** component (`import { m } from "framer-motion"`). `motion.div` throws under strict `LazyMotion`.
  - `ReducedMotionFlag` applies the user's Reduce motion setting to Framer Motion (`MotionConfig`) and to CSS (`html[data-reduced-motion="true"]`).
- **Heavy libraries load on demand.** React Flow and dagre load through `issue-tree/LazyIssueTree.tsx`, and recharts through `you/SolvedChart.tsx`, both via `next/dynamic` with `ssr: false`. Never import `IssueTree` or `recharts` directly into a page.

## Issue tree (components/issue-tree)

- `layout.ts` lays out nodes with dagre. Node height grows when a node shows a formula.
- `IssueTree.tsx` draws correct-path nodes blue and the others grey. `ROOT_CAUSE` nodes get a solid amber border, an amber tint and a "Root cause" target icon. The amber ring is reserved for the selected node.
- The CMS tree editor (`admin/TreeBuilder.tsx`) works in stable node **keys**. It keeps existing keys across saves and generates one only for a new node. The live-session view receives row ids. Either way the ids are only consistent within one tree.
