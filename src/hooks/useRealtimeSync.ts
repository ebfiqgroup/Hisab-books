import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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

/**
 * Subscribes to postgres_changes for the current user's data and invalidates
 * matching react-query caches so the UI updates in real time.
 */
export function useRealtimeSync(userId: string | undefined) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");

  useEffect(() => {
    if (!userId) { setStatus("disconnected"); return; }
    setStatus("connecting");
    const channel = supabase.channel(`rt-user-${userId}`, {
      config: { broadcast: { self: false }, presence: { key: "" } },
    });

    // Coalesce bursts of changes into a single invalidate per key (per ~80ms)
    const pending = new Map<string, ReturnType<typeof setTimeout>>();
    const scheduleInvalidate = (key: string[]) => {
      const k = key.join("/");
      if (pending.has(k)) return;
      const t = setTimeout(() => {
        pending.delete(k);
        qc.invalidateQueries({ queryKey: key, refetchType: "active" });
      }, 80);
      pending.set(k, t);
    };

    (Object.keys(TABLE_CONFIG) as Array<keyof typeof TABLE_CONFIG>).forEach((table) => {
      const { keys, userCol } = TABLE_CONFIG[table];
      (channel as unknown as {
        on: (
          event: string,
          filter: { event: string; schema: string; table: string; filter?: string },
          cb: () => void,
        ) => unknown;
      }).on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `${userCol}=eq.${userId}` },
        () => { for (const key of keys) scheduleInvalidate(key); },
      );
    });

    // support_messages: filter by sender_id so users see their own message echoes;
    // ticket-owner messages from admins flow via support_tickets bump trigger.
    (channel as unknown as {
      on: (e: string, f: { event: string; schema: string; table: string; filter?: string }, cb: () => void) => unknown;
    }).on(
      "postgres_changes",
      { event: "*", schema: "public", table: "support_messages", filter: `sender_id=eq.${userId}` },
      () => { scheduleInvalidate(["support_messages"]); scheduleInvalidate(["support_tickets"]); },
    );

    channel.subscribe((s: string) => {
      if (s === "SUBSCRIBED") setStatus("connected");
      else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") setStatus("disconnected");
      else setStatus("connecting");
    });
    return () => {
      pending.forEach((t) => clearTimeout(t));
      pending.clear();
      supabase.removeChannel(channel);
      setStatus("disconnected");
    };
  }, [userId, qc]);

  return status;
}