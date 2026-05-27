import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Conflict, resolveConflict } from "@/lib/offline-sync";
import { useLanguage } from "@/hooks/useLanguage";
import { fmtTk } from "@/lib/finance";

function Row({ label, mine, theirs }: { label: string; mine: unknown; theirs: unknown }) {
  const same = String(mine) === String(theirs);
  return (
    <div className="grid grid-cols-3 gap-2 text-xs py-1 border-b border-slate-100 last:border-0">
      <div className="text-slate-500 font-medium">{label}</div>
      <div className={same ? "text-slate-700" : "text-indigo-700 font-semibold"}>{String(mine ?? "—")}</div>
      <div className={same ? "text-slate-700" : "text-amber-700 font-semibold"}>{String(theirs ?? "—")}</div>
    </div>
  );
}

export function ConflictDialog({
  open,
  onClose,
  conflicts,
}: {
  open: boolean;
  onClose: () => void;
  conflicts: Conflict[];
}) {
  const { t } = useLanguage();
  const first = conflicts[0];
  if (!first) return null;

  const mine = first.op.payload as Record<string, unknown>;
  const theirs = first.serverRow;

  const handle = (choice: "keep-mine" | "keep-theirs") => {
    resolveConflict(first.op.id, choice);
    if (conflicts.length <= 1) onClose();
  };

  const fmt = (k: string, v: unknown) =>
    k === "amount" ? fmtTk(Number(v)) : v;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("ডাটা কনফ্লিক্ট", "Data conflict")}{" "}
            {conflicts.length > 1 && (
              <span className="text-xs text-slate-500 font-normal">
                ({t(`${conflicts.length} টি বাকি`, `${conflicts.length} remaining`)})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            {t(
              "আপনি অফলাইনে যে লেনদেন এডিট করেছিলেন সেটি অন্য ডিভাইস থেকেও পরিবর্তন হয়েছে। কোন ভার্সনটি রাখবেন?",
              "This transaction was edited offline, but another device also changed it. Which version should we keep?",
            )}
          </p>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="grid grid-cols-3 gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-200">
              <div>{t("ক্ষেত্র", "Field")}</div>
              <div className="text-indigo-700">{t("আপনার (অফলাইন)", "Yours (offline)")}</div>
              <div className="text-amber-700">{t("সার্ভার", "Server")}</div>
            </div>
            <Row label={t("ধরন", "Type")} mine={mine.type} theirs={theirs.type} />
            <Row label={t("ক্যাটাগরি", "Category")} mine={mine.category} theirs={theirs.category} />
            <Row label={t("পরিমাণ", "Amount")} mine={fmt("amount", mine.amount)} theirs={fmt("amount", theirs.amount)} />
            <Row label={t("তারিখ", "Date")} mine={mine.occurred_on} theirs={theirs.occurred_on} />
            <Row label={t("নোট", "Note")} mine={mine.note} theirs={theirs.note} />
          </div>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              onClick={() => handle("keep-mine")}
              className="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
            >
              {t("আমারটা রাখুন", "Keep mine")}
            </button>
            <button
              onClick={() => handle("keep-theirs")}
              className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200"
            >
              {t("সার্ভারেরটা রাখুন", "Keep server's")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}