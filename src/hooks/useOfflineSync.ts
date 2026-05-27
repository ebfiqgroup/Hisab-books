import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { outboxCount } from "@/lib/offline-db";
import { flush, getPendingConflicts, type Conflict } from "@/lib/offline-sync";
import { useOnlineStatus } from "./useOnlineStatus";
import { useLanguage } from "./useLanguage";

export function useOfflineSync() {
  const online = useOnlineStatus();
  const qc = useQueryClient();
  const { t } = useLanguage();
  const [pending, setPending] = useState(0);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    setPending(await outboxCount());
    setConflicts([...getPendingConflicts()]);
  }, []);

  const doFlush = useCallback(async (silent = false) => {
    setSyncing(true);
    try {
      const r = await flush();
      if (!silent && r.flushed > 0) {
        toast.success(t(`${r.flushed} টি অফলাইন এন্ট্রি সিঙ্ক হয়েছে`, `${r.flushed} offline entries synced`));
      }
      if (r.conflicts > 0) {
        toast.warning(t(`${r.conflicts} টি কনফ্লিক্ট পাওয়া গেছে`, `${r.conflicts} conflicts need your attention`));
      }
      if (r.flushed > 0) {
        qc.invalidateQueries({ queryKey: ["transactions"] });
      }
    } finally {
      setSyncing(false);
      await refreshCount();
    }
  }, [qc, t, refreshCount]);

  useEffect(() => {
    void refreshCount();
    const onChange = () => { void refreshCount(); };
    window.addEventListener("offline-outbox-change", onChange);
    window.addEventListener("offline-conflict-change", onChange);
    return () => {
      window.removeEventListener("offline-outbox-change", onChange);
      window.removeEventListener("offline-conflict-change", onChange);
    };
  }, [refreshCount]);

  useEffect(() => {
    if (online) void doFlush(true);
  }, [online, doFlush]);

  return { online, pending, conflicts, syncing, flush: () => doFlush(false) };
}