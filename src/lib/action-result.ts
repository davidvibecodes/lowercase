import { ServiceError } from "@/server/services/errors";

/** What every page server action returns: data on success, a user-facing message on failure. */
export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Builds the `run()` wrapper a route's `actions.ts` uses. `revalidate` runs
 * after `fn` succeeds. A `ServiceError` message reaches the user; anything else
 * becomes "Something went wrong". Auth that must fail as a result (admin) goes
 * inside `fn`; auth that may throw (requireUser) goes before calling `run`.
 */
export function createActionRunner(revalidate: () => void) {
  return async function run<T extends object>(fn: () => Promise<T | void>): Promise<ActionResult<T>> {
    try {
      const out = (await fn()) ?? ({} as T);
      revalidate();
      return { ok: true, ...out };
    } catch (e) {
      return { ok: false, error: e instanceof ServiceError ? e.message : "Something went wrong" };
    }
  };
}
