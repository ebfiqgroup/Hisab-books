import { useEffect, useState } from "react";
import { useRouteContext } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the current authenticated user's id. Prefers the SSR-resolved
 * `initialUserId` from `_authenticated` route context, and falls back to a
 * live client-side session lookup when SSR could not resolve it (so queries
 * never fire with `user_id=undefined`).
 */
export function useCurrentUserId(): string {
  const ctx = useRouteContext({ from: "/_authenticated" });
  const initial = ctx.initialUserId as string | undefined;
  const [uid, setUid] = useState<string | undefined>(initial);

  useEffect(() => {
    if (initial) { setUid(initial); return; }
    let cancel = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancel && data.session?.user?.id) setUid(data.session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.user?.id) setUid(s.user.id);
    });
    return () => { cancel = true; subscription.unsubscribe(); };
  }, [initial]);

  return uid as string;
}