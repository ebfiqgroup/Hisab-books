import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

const ROLES_CHANGED_EVENT = "roles:changed";

export function notifyRolesChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ROLES_CHANGED_EVENT));
  }
}

export function useIsAdmin() {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancel = false;
    if (loading) { setIsAdmin(null); return; }
    if (!user) { setIsAdmin(false); return; }
    const fetchRole = async () => {
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
    };
    fetchRole();
    const onChange = () => fetchRole();
    window.addEventListener(ROLES_CHANGED_EVENT, onChange);
    const nonce = Math.random().toString(36).slice(2, 10);
    const channel = supabase
      .channel(`user_roles:admin:${user.id}:${nonce}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` }, () => fetchRole())
      .subscribe();
    return () => {
      cancel = true;
      window.removeEventListener(ROLES_CHANGED_EVENT, onChange);
      supabase.removeChannel(channel);
    };
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
    const fetchRole = async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();
      if (error) { if (!cancel) setIsSuper(false); return; }
      if (!cancel) setIsSuper(!!data);
    };
    fetchRole();
    const onChange = () => fetchRole();
    window.addEventListener(ROLES_CHANGED_EVENT, onChange);
    const nonce = Math.random().toString(36).slice(2, 10);
    const channel = supabase
      .channel(`user_roles:super:${user.id}:${nonce}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` }, () => fetchRole())
      .subscribe();
    return () => {
      cancel = true;
      window.removeEventListener(ROLES_CHANGED_EVENT, onChange);
      supabase.removeChannel(channel);
    };
  }, [loading, user?.id]);

  return isSuper;
}