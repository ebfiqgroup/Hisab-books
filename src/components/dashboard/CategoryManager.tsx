import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, Check, X, RotateCcw } from "lucide-react";
import {
  BUILTIN_CATS_RAW,
  builtinsFor,
  loadCustomCats,
  saveCustomCats,
  type TxnType,
} from "@/lib/finance";
import { fmtTk } from "@/lib/finance";
import { useLanguage } from "@/hooks/useLanguage";

export function CategoryManager({
  open,
  onOpenChange,
  type,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  type: TxnType;
}) {
  const qc = useQueryClient();
  const { t } = useLanguage();
  const [map, setMap] = useState(() => loadCustomCats());
  const [editingName, setEditingName] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState<
    | { kind: "custom" | "builtin"; name: string; raw?: string; used: number; target: string }
    | null
  >(null);
  const [preview, setPreview] = useState<{
    loading: boolean;
    rows: Array<{ id: string; amount: number; note: string | null; occurred_on: string }>;
  }>({ loading: false, rows: [] });

  const custom = map[type];
  const builtInsRaw = BUILTIN_CATS_RAW[type];
  const renames = map.renames?.[type] ?? {};
  const effective = (raw: string) => renames[raw] ?? raw;
  const fallbackTarget = () => {
    // Effective name of "অন্যান্য" if it's still active; otherwise raw.
    const hidden = new Set(map.hidden?.[type] ?? []);
    if (hidden.has("অন্যান্য")) return "অন্যান্য"; // re-activate raw on use
    return effective("অন্যান্য");
  };

  // All currently-available category names (excluding the one being deleted)
  const availableTargets = (excludeEffective: string): string[] => {
    const active = [...builtinsFor(type, map), ...custom];
    return active.filter((n) => n !== excludeEffective);
  };

  const startEdit = (name: string) => { setEditingName(name); setDraft(name); };
  const cancelEdit = () => { setEditingName(null); setDraft(""); };

  const saveRenameCustom = async (oldName: string) => {
    const newName = draft.trim();
    if (!newName) { toast.error(t("নাম দিন", "Enter a name")); return; }
    if (newName === oldName) { cancelEdit(); return; }
    const all = [...builtinsFor(type, map), ...custom];
    if (all.includes(newName)) { toast.error(t("এই নাম ইতিমধ্যে আছে", "This name already exists")); return; }
    setBusy(true);
    const { error } = await supabase
      .from("transactions")
      .update({ category: newName })
      .eq("type", type)
      .eq("category", oldName);
    if (error) { setBusy(false); toast.error(error.message); return; }
    const next = { ...map, [type]: custom.map((c) => (c === oldName ? newName : c)) };
    setMap(next); saveCustomCats(next);
    cancelEdit(); setBusy(false);
    toast.success(t("ক্যাটাগরি আপডেট হয়েছে", "Category updated"));
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  const saveRenameBuiltin = async (rawName: string) => {
    const newName = draft.trim();
    const currentEffective = effective(rawName);
    if (!newName) { toast.error(t("নাম দিন", "Enter a name")); return; }
    if (newName === currentEffective) { cancelEdit(); return; }
    const all = [...builtinsFor(type, map).filter((n) => n !== currentEffective), ...custom];
    if (all.includes(newName)) { toast.error(t("এই নাম ইতিমধ্যে আছে", "This name already exists")); return; }
    setBusy(true);
    const { error } = await supabase
      .from("transactions")
      .update({ category: newName })
      .eq("type", type)
      .eq("category", currentEffective);
    if (error) { setBusy(false); toast.error(error.message); return; }
    const nextRenames = {
      income: { ...(map.renames?.income ?? {}) },
      expense: { ...(map.renames?.expense ?? {}) },
    };
    if (newName === rawName) delete nextRenames[type][rawName];
    else nextRenames[type][rawName] = newName;
    const next = { ...map, renames: nextRenames };
    setMap(next); saveCustomCats(next);
    cancelEdit(); setBusy(false);
    toast.success(t("ক্যাটাগরি আপডেট হয়েছে", "Category updated"));
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  const resetBuiltin = async (rawName: string) => {
    const currentEffective = effective(rawName);
    if (currentEffective === rawName) return;
    if (!confirm(t(`"${currentEffective}" কে আবার "${rawName}" নামে ফিরিয়ে আনবেন?`, `Reset "${currentEffective}" back to "${rawName}"?`))) return;
    setBusy(true);
    const { error } = await supabase
      .from("transactions")
      .update({ category: rawName })
      .eq("type", type)
      .eq("category", currentEffective);
    if (error) { setBusy(false); toast.error(error.message); return; }
    const nextRenames = {
      income: { ...(map.renames?.income ?? {}) },
      expense: { ...(map.renames?.expense ?? {}) },
    };
    delete nextRenames[type][rawName];
    const next = { ...map, renames: nextRenames };
    setMap(next); saveCustomCats(next);
    setBusy(false);
    toast.success(t("রিসেট হয়েছে", "Reset done"));
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  const removeCategory = async (name: string) => {
    const { count, error: ce } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("type", type)
      .eq("category", name);
    if (ce) { toast.error(ce.message); return; }
    const used = count ?? 0;
    setConfirmDel({ kind: "custom", name, used, target: fallbackTarget() });
  };

  const removeBuiltin = async (raw: string) => {
    if (raw === "অন্যান্য") { toast.error(t("\"অন্যান্য\" মুছে ফেলা যাবে না (ফলব্যাক ক্যাটাগরি)", "\"Other\" cannot be deleted (fallback category)")); return; }
    const cur = effective(raw);
    const { count, error: ce } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("type", type)
      .eq("category", cur);
    if (ce) { toast.error(ce.message); return; }
    const used = count ?? 0;
    setConfirmDel({ kind: "builtin", name: cur, raw, used, target: fallbackTarget() });
  };

  // Load top transactions when delete dialog opens for a non-empty category
  useEffect(() => {
    if (!confirmDel || confirmDel.used === 0) { setPreview({ loading: false, rows: [] }); return; }
    let cancelled = false;
    setPreview({ loading: true, rows: [] });
    (async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, amount, note, occurred_on")
        .eq("type", type)
        .eq("category", confirmDel.name)
        .order("occurred_on", { ascending: false })
        .limit(5);
      if (cancelled) return;
      if (error) { setPreview({ loading: false, rows: [] }); return; }
      setPreview({ loading: false, rows: (data ?? []) as any });
    })();
    return () => { cancelled = true; };
  }, [confirmDel, type]);

  const performDelete = async () => {
    if (!confirmDel) return;
    const { kind, name, raw, used, target } = confirmDel;
    if (used > 0 && !target) { toast.error(t("টার্গেট ক্যাটাগরি দিন", "Choose a target category")); return; }
    setBusy(true);
    if (used > 0) {
      const { error } = await supabase
        .from("transactions")
        .update({ category: target })
        .eq("type", type)
        .eq("category", name);
      if (error) { setBusy(false); toast.error(error.message); return; }
    }
    if (kind === "custom") {
      const next = { ...map, [type]: custom.filter((c) => c !== name) };
      setMap(next); saveCustomCats(next);
    } else if (raw) {
      const nextHidden = {
        income: [...(map.hidden?.income ?? [])],
        expense: [...(map.hidden?.expense ?? [])],
      };
      if (!nextHidden[type].includes(raw)) nextHidden[type].push(raw);
      const next = { ...map, hidden: nextHidden };
      setMap(next); saveCustomCats(next);
    }
    setBusy(false);
    setConfirmDel(null);
    toast.success(t("মুছে ফেলা হয়েছে", "Deleted"));
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  const restoreBuiltin = (raw: string) => {
    const nextHidden = {
      income: (map.hidden?.income ?? []).filter((x) => x !== raw),
      expense: (map.hidden?.expense ?? []).filter((x) => x !== raw),
    };
    const next = { ...map, hidden: nextHidden };
    setMap(next); saveCustomCats(next);
    toast.success(t("ফিরিয়ে আনা হয়েছে", "Restored"));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("ক্যাটাগরি ব্যবস্থাপনা", "Manage categories")} ({type === "income" ? t("আয়", "Income") : t("ব্যয়", "Expense")})</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="text-xs text-slate-500 mb-2">{t("আমার ক্যাটাগরি", "My categories")}</div>
            {custom.length === 0 ? (
              <div className="text-sm text-slate-400 py-3 text-center border border-dashed border-slate-200 rounded-lg">{t("কোনো কাস্টম ক্যাটাগরি নেই", "No custom categories")}</div>
            ) : (
              <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {custom.map((c) => (
                  <li key={c} className="flex items-center gap-2 px-3 py-2">
                    {editingName === c ? (
                      <>
                        <input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); saveRenameCustom(c); }
                            if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                          }}
                          className="flex-1 px-2 py-1 border border-slate-200 rounded-md text-sm"
                        />
                        <button disabled={busy} onClick={() => saveRenameCustom(c)} className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-600 disabled:opacity-50" title={t("সেভ", "Save")}>
                          <Check className="w-4 h-4" />
                        </button>
                        <button disabled={busy} onClick={cancelEdit} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 disabled:opacity-50" title={t("বাতিল", "Cancel")}>
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-slate-700">{c}</span>
                        <button disabled={busy} onClick={() => startEdit(c)} className="p-1.5 rounded-md hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 disabled:opacity-50" title={t("এডিট", "Edit")}>
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button disabled={busy} onClick={() => removeCategory(c)} className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 disabled:opacity-50" title={t("মুছুন", "Delete")}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="text-[11px] text-slate-400">{t("টিপ: নতুন ক্যাটাগরি যোগ করতে \"নতুন আয়/ব্যয়\" ডায়ালগ ব্যবহার করুন।", "Tip: To add a new category, use the \"New income/expense\" dialog.")}</div>
        </div>
      </DialogContent>
      <Dialog open={!!confirmDel} onOpenChange={(v) => { if (!busy && !v) setConfirmDel(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("ক্যাটাগরি মুছে ফেলুন", "Delete category")}</DialogTitle>
          </DialogHeader>
          {confirmDel && (
            <div className="space-y-3 text-sm">
              <div className="text-slate-700">
                <span className="font-medium">"{confirmDel.name}"</span> {t("ক্যাটাগরি মুছবেন?", "delete this category?")}
              </div>
              {confirmDel.used > 0 ? (
                <div className="space-y-2">
                  <div className="text-slate-600">
                    {t("এই ক্যাটাগরিতে", "This category has")} <span className="font-medium">{confirmDel.used}</span>{t("টি লেনদেন আছে। সেগুলো কোন ক্যাটাগরিতে সরাবেন?", " transactions. Where should they be moved?")}
                  </div>
                  <select
                    value={confirmDel.target}
                    onChange={(e) => setConfirmDel({ ...confirmDel, target: e.target.value })}
                    className="w-full px-2 py-2 border border-slate-200 rounded-md text-sm"
                    disabled={busy}
                  >
                    {availableTargets(confirmDel.name).map((ct) => (
                      <option key={ct} value={ct}>{ct}</option>
                    ))}
                  </select>
                  <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                    <div className="text-[11px] text-slate-500 mb-1.5">
                      <span className="font-medium">{confirmDel.used}</span>{t("টি লেনদেন ", " transactions will move to ")}
                      <span className="font-medium">"{confirmDel.target}"</span>{t("-তে যাবে। সর্বশেষ ", ". Last ")}{Math.min(5, confirmDel.used)}{t("টি প্রিভিউ:", " preview:")}
                    </div>
                    {preview.loading ? (
                      <div className="text-xs text-slate-400 py-1">{t("লোড হচ্ছে...", "Loading...")}</div>
                    ) : preview.rows.length === 0 ? (
                      <div className="text-xs text-slate-400 py-1">{t("কোনো প্রিভিউ নেই", "No preview")}</div>
                    ) : (
                      <ul className="divide-y divide-slate-200">
                        {preview.rows.map((r) => (
                          <li key={r.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-slate-700">{r.note || "—"}</div>
                              <div className="text-[10px] text-slate-400">{r.occurred_on}</div>
                            </div>
                            <div className="font-medium text-slate-700 shrink-0">{fmtTk(Number(r.amount))}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                    {confirmDel.used > preview.rows.length && !preview.loading && (
                      <div className="text-[10px] text-slate-400 mt-1">
                        +{confirmDel.used - preview.rows.length}{t("টি আরও", " more")}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-slate-500 text-xs">{t("এই ক্যাটাগরিতে কোনো লেনদেন নেই।", "No transactions in this category.")}</div>
              )}
            </div>
          )}
          <DialogFooter>
            <button
              disabled={busy}
              onClick={() => setConfirmDel(null)}
              className="px-3 py-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
            >
              {t("বাতিল", "Cancel")}
            </button>
            <button
              disabled={busy}
              onClick={performDelete}
              className="px-3 py-1.5 text-sm rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {busy ? t("মুছছি...", "Deleting...") : t("মুছুন", "Delete")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}