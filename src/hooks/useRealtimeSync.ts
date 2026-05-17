import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Map db tables → react-query keys (prefix-match invalidation)
const TABLE_KEYS: Record<string, string[][]> = {
  transactions: [["transactions"]],
  debts: [["debts"]],
  goals: [["goals"]],
  budgets: [["budgets"]],
  notes: [["notes"]],
  plan_tasks: [["plan_tasks"]],
  profiles: [["profile"], ["ref_code"]],
  support_messages: [["support_messages"], ["support_tickets"]],
  support_tickets: [["support_tickets"]],
};

/**
 * Subscribes to postgres_changes for the current user's data and invalidates
 * matching react-query caches so the UI updates in real time.
 */
export function useRealtimeSync(userId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    const tables = Object.keys(TABLE_KEYS);
    const channel = supabase.channel(`rt-user-${userId}`);

    tables.forEach((table) => {
      channel.on(
        // @ts-expect-error - supabase-js realtime types
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          for (const key of TABLE_KEYS[table]) {
            qc.invalidateQueries({ queryKey: key });
          }
        },
      );
    });

    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);
}