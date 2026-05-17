import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useRefCode() {
  const { user } = useAuth();
  const [refCode, setRefCode] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setRefCode(null); return; }
    let cancelled = false;
    supabase.from("profiles").select("ref_code").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (!cancelled) setRefCode((data?.ref_code as string) ?? null); });
    return () => { cancelled = true; };
  }, [user]);

  return refCode;
}