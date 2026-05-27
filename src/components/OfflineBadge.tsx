import { useState } from "react";
import { Wifi, WifiOff, RotateCw, AlertTriangle } from "lucide-react";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { ConflictDialog } from "./ConflictDialog";
import { useLanguage } from "@/hooks/useLanguage";

export function OfflineBadge() {
  const { online, pending, conflicts, syncing, flush } = useOfflineSync();
  const { t } = useLanguage();
  const [showConflicts, setShowConflicts] = useState(false);

  // Auto-open conflict dialog when new conflicts arrive
  if (conflicts.length > 0 && !showConflicts) {
    queueMicrotask(() => setShowConflicts(true));
  }

  if (online && pending === 0 && conflicts.length === 0) {
    // Tiny indicator only — keep header clean
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        {!online && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
            style={{ background: "color-mix(in oklab, #f43f5e 16%, transparent)", color: "#be123c" }}
            title={t("আপনি অফলাইনে আছেন", "You are offline")}
          >
            <WifiOff className="w-3 h-3" />
            <span className="hidden sm:inline">{t("অফলাইন", "Offline")}</span>
          </span>
        )}
        {pending > 0 && (
          <button
            type="button"
            onClick={() => flush()}
            disabled={syncing || !online}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold disabled:opacity-60"
            style={{ background: "color-mix(in oklab, #6366f1 16%, transparent)", color: "#4338ca" }}
            title={t("সিঙ্ক বাকি", "Pending sync")}
          >
            <RotateCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
            <span>{pending}</span>
            <span className="hidden sm:inline">{t("বাকি", "pending")}</span>
          </button>
        )}
        {conflicts.length > 0 && (
          <button
            type="button"
            onClick={() => setShowConflicts(true)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
            style={{ background: "color-mix(in oklab, #f59e0b 18%, transparent)", color: "#b45309" }}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>{conflicts.length}</span>
            <span className="hidden sm:inline">{t("কনফ্লিক্ট", "conflicts")}</span>
          </button>
        )}
        {online && pending === 0 && conflicts.length === 0 && (
          <Wifi className="w-3 h-3 text-emerald-500" />
        )}
      </div>
      <ConflictDialog open={showConflicts} onClose={() => setShowConflicts(false)} conflicts={conflicts} />
    </>
  );
}