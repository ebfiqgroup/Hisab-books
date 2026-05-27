import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Map db tables → react-query keys (prefix-match invalidation) + the column
// to filter by user. Server-side filtering massively reduces realtime traffic
// vs. relying on RLS alone (which still ships every row over the socket).
const TABLE_CONFIG: Record<string, { keys: string[][]; userCol: string }> = {
  transactions: { keys: [["transactions"]], userCol: "user_id" },
  debts: { keys: [["debts"]], userCol: "user_id" },
  goals: { keys: [["goals"]], userCol: "user_id" },
  budgets: { keys: [["budgets"]], userCol: "user_id" },
  notes: { keys: [["notes"]], userCol: "user_id" },
  plan_tasks: { keys: [["plan_tasks"]], userCol: "user_id" },
  profiles: { keys: [["profile"], ["ref_code"]], userCol: "id" },
  support_tickets: { keys: [["support_tickets"]], userCol: "user_id" },
};

function matchesPrefix(queryKey: QueryKey, prefix: string[]) {
  if (!Array.isArray(queryKey) || queryKey.length < prefix.length) return false;
  return prefix.every((value, index) => queryKey[index] === value);
}

/**
 * Subscribes to postgres_changes for the current user's data and invalidates
 * matching react-query caches so the UI updates in real time.
 */
export function useRealtimeSync(userId: string | undefined) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const prevStatusRef = useRef<"connecting" | "connected" | "disconnected">("connecting");
  const everConnectedRef = useRef(false);
  const lastErrorRef = useRef<string | null>(null);
  const failCountRef = useRef(0);
  const reconnectRef = useRef<(() => void) | null>(null);

  const refreshKeys = useCallback((keys?: string[][]) => {
    if (!keys) {
      qc.invalidateQueries({ refetchType: "active" });
      return;
    }
    for (const key of keys) {
      qc.invalidateQueries({ queryKey: key, refetchType: "active" });
      qc.refetchQueries({
        type: "active",
        predicate: (query) => matchesPrefix(query.queryKey, key),
      });
    }
  }, [qc]);

  useEffect(() => {
    const prev = prevStatusRef.current;
    if (prev !== status) {
      if (status === "connected") {
        if (everConnectedRef.current) {
          toast.success("রিয়েলটাইম সংযোগ পুনরায় স্থাপন হয়েছে", {
            description: "আপনার ডেটা এখন আবার লাইভ আপডেট হচ্ছে।",
          });
        }
        everConnectedRef.current = true;
        failCountRef.current = 0;
        lastErrorRef.current = null;
      } else if (status === "disconnected" && everConnectedRef.current) {
        const reason = lastErrorRef.current ?? "unknown";
        const friendly =
          reason === "TIMED_OUT" ? "সার্ভারের সাড়া পাওয়া যাচ্ছে না।" :
          reason === "CHANNEL_ERROR" ? "সার্ভারে সংযোগ ত্রুটি হয়েছে।" :
          reason === "CLOSED" ? "সংযোগ বন্ধ হয়ে গেছে।" :
          "ইন্টারনেট সংযোগ পরীক্ষা করুন।";
        // Structured developer log for debugging.
        console.warn("[realtime] disconnected", {
          userId: userId ? `${userId.slice(0, 8)}…` : null,
          reason,
          failCount: failCountRef.current,
          tables: Object.keys(TABLE_CONFIG),
          time: new Date().toISOString(),
        });
        toast.error("রিয়েলটাইম সংযোগ বিচ্ছিন্ন", {
          description: `${friendly} আপডেটগুলো সাময়িকভাবে দেরিতে আসতে পারে।`,
          action: reconnectRef.current
            ? { label: "পুনঃচেষ্টা", onClick: () => reconnectRef.current?.() }
            : undefined,
        });
      }
      prevStatusRef.current = status;
    }
  }, [status, userId]);

  useEffect(() => {
    if (!userId) { setStatus("disconnected"); return; }
    setStatus("connecting");

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const buildChannel = () => {
      const ch = supabase.channel(`rt-user-${userId}-${Date.now()}`);
      (Object.keys(TABLE_CONFIG) as Array<keyof typeof TABLE_CONFIG>).forEach((table) => {
        const { keys, userCol } = TABLE_CONFIG[table];
        (ch as unknown as {
          on: (e: string, f: { event: string; schema: string; table: string; filter?: string }, cb: () => void) => unknown;
        }).on(
          "postgres_changes",
          { event: "*", schema: "public", table, filter: `${userCol}=eq.${userId}` },
          () => refreshKeys(keys),
        );
      });
      (ch as unknown as {
        on: (e: string, f: { event: string; schema: string; table: string; filter?: string }, cb: () => void) => unknown;
      }).on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_messages", filter: `sender_id=eq.${userId}` },
        () => refreshKeys([["support_messages"], ["support_tickets"]]),
      );
      ch.subscribe((s: string) => {
        if (s === "SUBSCRIBED") {
          lastErrorRef.current = null;
          setStatus("connected");
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
          lastErrorRef.current = s;
          failCountRef.current += 1;
          console.warn("[realtime] subscribe status", s, { failCount: failCountRef.current });
          setStatus("disconnected");
        } else {
          setStatus("connecting");
        }
      });
      return ch;
    };

    // CRITICAL: authenticate realtime socket BEFORE subscribing. Otherwise
    // postgres_changes joins without a JWT and RLS silently drops every event.
    const start = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          try { (supabase.realtime as unknown as { setAuth: (t: string) => void }).setAuth(token); } catch { /* noop */ }
        }
      } catch { /* noop */ }
      if (cancelled) return;
      channel = buildChannel();
    };
    void start();

    const reconnect = async () => {
      console.info("[realtime] reconnecting", { reason: lastErrorRef.current });
      if (channel) { try { supabase.removeChannel(channel); } catch { /* noop */ } channel = null; }
      setStatus("connecting");
      await start();
      refreshKeys();
    };
    reconnectRef.current = () => { void reconnect(); };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshKeys();
        if (!channel || channel.state !== "joined") void reconnect();
      }
    };
    const onOnline = () => { void reconnect(); };
    const onFocus = () => {
      refreshKeys();
      if (!channel || channel.state !== "joined") void reconnect();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_e, session) => {
      const token = session?.access_token;
      if (token) {
        // Re-authenticate the existing realtime socket in-place. This keeps
        // the channel joined (no event flash) while the new JWT propagates
        // to postgres_changes RLS checks. Only fall back to a full reconnect
        // if the socket isn't actually joined.
        try {
          (supabase.realtime as unknown as { setAuth: (t: string) => void }).setAuth(token);
        } catch { /* noop */ }
      }
      if (_e === "SIGNED_IN" && (!channel || channel.state !== "joined")) {
        void reconnect();
      } else if (_e === "SIGNED_OUT") {
        if (channel) { try { supabase.removeChannel(channel); } catch { /* noop */ } channel = null; }
        setStatus("disconnected");
      }
    });

    return () => {
      cancelled = true;
      reconnectRef.current = null;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
      authSub.unsubscribe();
      if (channel) { try { supabase.removeChannel(channel); } catch { /* noop */ } }
      setStatus("disconnected");
    };
  }, [userId, refreshKeys]);

  return status;
}