// Flushes the offline outbox to Supabase when the device is online.
// Handles update conflicts by raising an event the UI can pick up.

import { supabase } from "@/integrations/supabase/client";
import { listOutbox, removeOp, updateOp, type OutboxOp } from "./offline-db";

export type Conflict = {
  op: OutboxOp;
  serverRow: Record<string, unknown>;
};

let _flushing = false;
let _pendingConflicts: Conflict[] = [];

export function getPendingConflicts() {
  return _pendingConflicts;
}

export function resolveConflict(opId: string, choice: "keep-mine" | "keep-theirs") {
  const idx = _pendingConflicts.findIndex((c) => c.op.id === opId);
  if (idx < 0) return;
  const [conflict] = _pendingConflicts.splice(idx, 1);
  if (choice === "keep-theirs") {
    // discard our queued update
    void removeOp(conflict.op.id);
  } else {
    // mark op to force-write next flush
    void updateOp({ ...conflict.op, baseSnapshot: conflict.serverRow });
    void flush();
  }
  window.dispatchEvent(new CustomEvent("offline-conflict-change"));
}

function emitConflicts() {
  window.dispatchEvent(new CustomEvent("offline-conflict-change"));
}

function shallowDiffers(a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined, keys: string[]) {
  if (!a || !b) return false;
  for (const k of keys) if (a[k] !== b[k]) return true;
  return false;
}

export async function flush(): Promise<{ flushed: number; conflicts: number; failed: number }> {
  if (_flushing) return { flushed: 0, conflicts: 0, failed: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) return { flushed: 0, conflicts: 0, failed: 0 };
  _flushing = true;
  let flushed = 0, conflicts = 0, failed = 0;
  try {
    const ops = await listOutbox();
    ops.sort((a, b) => a.queuedAt - b.queuedAt);
    for (const op of ops) {
      try {
        if (op.table === "transactions") {
          if (op.op === "insert") {
            const p = op.payload as Record<string, unknown>;
            const { error } = await supabase.from("transactions").insert({
              user_id: op.userId,
              type: p.type as "income" | "expense",
              category: String(p.category),
              amount: Number(p.amount),
              occurred_on: String(p.occurred_on),
              note: (p.note as string | null) ?? null,
            });
            if (error) throw error;
            await removeOp(op.id);
            flushed++;
          } else if (op.op === "update" && op.rowId) {
            // Conflict detection: re-fetch the row, compare with baseSnapshot
            const { data: current, error: fErr } = await supabase
              .from("transactions")
              .select("id,type,category,amount,occurred_on,note")
              .eq("id", op.rowId)
              .maybeSingle();
            if (fErr) throw fErr;
            if (!current) {
              // Row disappeared — drop the queued update
              await removeOp(op.id);
              continue;
            }
            const conflictDetected = shallowDiffers(
              current as Record<string, unknown>,
              op.baseSnapshot,
              ["type", "category", "amount", "occurred_on", "note"],
            );
            if (conflictDetected) {
              if (!_pendingConflicts.find((c) => c.op.id === op.id)) {
                _pendingConflicts.push({ op, serverRow: current as Record<string, unknown> });
                conflicts++;
              }
              continue;
            }
            const p = op.payload as Record<string, unknown>;
            const { error } = await supabase
              .from("transactions")
              .update({
                type: p.type as "income" | "expense",
                category: String(p.category),
                amount: Number(p.amount),
                occurred_on: String(p.occurred_on),
                note: (p.note as string | null) ?? null,
              })
              .eq("id", op.rowId)
              .eq("user_id", op.userId);
            if (error) throw error;
            await removeOp(op.id);
            flushed++;
          } else if (op.op === "delete" && op.rowId) {
            const { error } = await supabase
              .from("transactions")
              .delete()
              .eq("id", op.rowId)
              .eq("user_id", op.userId);
            if (error) throw error;
            await removeOp(op.id);
            flushed++;
          }
        }
      } catch (e) {
        failed++;
        await updateOp({ ...op, attempts: op.attempts + 1, lastError: (e as Error).message });
      }
    }
    if (conflicts > 0) emitConflicts();
  } finally {
    _flushing = false;
  }
  return { flushed, conflicts, failed };
}