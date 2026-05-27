// IndexedDB-backed outbox for offline mutations.
// Stores queued operations until the device is online, then sync flushes them.

import { openDB, type IDBPDatabase } from "idb";

export type OutboxOp = {
  id: string; // local uuid
  table: "transactions";
  op: "insert" | "update" | "delete";
  payload: Record<string, unknown>;
  baseSnapshot?: Record<string, unknown>; // for update conflict detection
  rowId?: string; // for update/delete, the server row id
  userId: string;
  queuedAt: number;
  attempts: number;
  lastError?: string;
};

const DB_NAME = "amar-hishab-offline";
const DB_VERSION = 1;

let _db: Promise<IDBPDatabase> | null = null;
function db() {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB not available");
  }
  if (!_db) {
    _db = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains("outbox")) {
          d.createObjectStore("outbox", { keyPath: "id" });
        }
        if (!d.objectStoreNames.contains("kv")) {
          d.createObjectStore("kv");
        }
      },
    });
  }
  return _db;
}

export async function enqueue(op: Omit<OutboxOp, "id" | "queuedAt" | "attempts">) {
  const d = await db();
  const id = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
  const full: OutboxOp = { ...op, id, queuedAt: Date.now(), attempts: 0 };
  await d.put("outbox", full);
  notifyChange();
  return full;
}

export async function listOutbox(): Promise<OutboxOp[]> {
  try {
    const d = await db();
    return (await d.getAll("outbox")) as OutboxOp[];
  } catch {
    return [];
  }
}

export async function removeOp(id: string) {
  const d = await db();
  await d.delete("outbox", id);
  notifyChange();
}

export async function updateOp(op: OutboxOp) {
  const d = await db();
  await d.put("outbox", op);
  notifyChange();
}

export async function outboxCount(): Promise<number> {
  try {
    const d = await db();
    return await d.count("outbox");
  } catch {
    return 0;
  }
}

function notifyChange() {
  try {
    window.dispatchEvent(new CustomEvent("offline-outbox-change"));
  } catch { /* SSR */ }
}