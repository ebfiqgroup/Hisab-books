// Offline-aware helpers for transactions. Use these instead of calling supabase directly
// so writes work both online and offline.

import { supabase } from "@/integrations/supabase/client";
import { enqueue } from "./offline-db";
import { flush } from "./offline-sync";

export type TxnPayload = {
  type: "income" | "expense";
  category: string;
  amount: number;
  occurred_on: string;
  note: string | null;
};

function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export async function saveTxnOffline(
  userId: string,
  payload: TxnPayload,
  edit?: { id: string; base: TxnPayload },
): Promise<{ ok: true; queued: boolean; error?: undefined } | { ok: false; error: string }> {
  if (isOnline()) {
    try {
      const { error } = edit
        ? await supabase.from("transactions").update(payload).eq("id", edit.id).eq("user_id", userId)
        : await supabase.from("transactions").insert({ user_id: userId, ...payload });
      if (error) throw error;
      // Opportunistic flush in case earlier queue items exist
      void flush();
      return { ok: true, queued: false };
    } catch (e) {
      // Network may have just dropped — fall through to queue
      if (isOnline()) return { ok: false, error: (e as Error).message };
    }
  }
  await enqueue(
    edit
      ? { table: "transactions", op: "update", payload, rowId: edit.id, baseSnapshot: edit.base, userId }
      : { table: "transactions", op: "insert", payload, userId },
  );
  return { ok: true, queued: true };
}

export async function deleteTxnOffline(userId: string, rowId: string) {
  if (isOnline()) {
    try {
      const { error } = await supabase.from("transactions").delete().eq("id", rowId).eq("user_id", userId);
      if (error) throw error;
      void flush();
      return { ok: true, queued: false };
    } catch (e) {
      if (isOnline()) return { ok: false, error: (e as Error).message };
    }
  }
  await enqueue({ table: "transactions", op: "delete", payload: {}, rowId, userId });
  return { ok: true, queued: true };
}