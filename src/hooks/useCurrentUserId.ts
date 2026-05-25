import { useRouteContext } from "@tanstack/react-router";

/**
 * Returns the current authenticated user's id from the `_authenticated`
 * layout route context. Use this to scope queries/mutations to the active
 * user so admins (who have RLS "view all" policies) don't accidentally
 * see or modify other users' rows on personal pages.
 */
export function useCurrentUserId(): string {
  const ctx = useRouteContext({ from: "/_authenticated" });
  return ctx.initialUserId as string;
}