import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useIsAdmin() {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancel = false;
    if (loading) { setIsAdmin(null); return; }
    if (!user) { setIsAdmin(false); return; }
    (async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "super_admin"])
        .limit(1)
        .maybeSingle();
      if (error) {
        if (!cancel) setIsAdmin(false);
        return;
      }
      if (!cancel) setIsAdmin(!!data);
    })();
    return () => { cancel = true; };
  }, [loading, user?.id]);

  return isAdmin;
}

export function useIsSuperAdmin() {
  const { user, loading } = useAuth();
  const [isSuper, setIsSuper] = useState<boolean | null>(null);

  useEffect(() => {
    let cancel = false;
    if (loading) { setIsSuper(null); return; }
    if (!user) { setIsSuper(false); return; }
    (async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();
      if (error) { if (!cancel) setIsSuper(false); return; }
      if (!cancel) setIsSuper(!!data);
    })();
    return () => { cancel = true; };
  }, [loading, user?.id]);

  return isSuper;
}