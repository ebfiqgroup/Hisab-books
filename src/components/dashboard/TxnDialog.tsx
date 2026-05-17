import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X, Loader2 } from "lucide-react";
import {
  BUILTIN_CATS,
  loadCustomCats,
  saveCustomCats,
  type CustomCatMap,
  type TxnType,
} from "@/lib/finance";
import { useLanguage } from "@/hooks/useLanguage";

export type EditTxn = {
  id: string;
  type: TxnType;
  category: string;
  amount: number;
  occurred_on: string;
  note: string | null;
};

export function TxnDialog({
  open,
  onOpenChange,
  editTxn,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editTxn?: EditTxn | null;
}) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [type, setType] = useState<TxnType>("expense");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [customMap, setCustomMap] = useState<CustomCatMap>({ income: [], expense: [] });
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState("");

  useEffect(() => {
    if (open) {
      if (editTxn) {
        setType(editTxn.type);
        setCategory(editTxn.category);
        setAmount(String(editTxn.amount));
        setDate(editTxn.occurred_on);
        setNote(editTxn.note ?? "");
      } else {
        setType("expense"); setAmount(""); setNote("");
        const m = loadCustomCats();
        setCategory(m.expense[0] ?? "");
        setDate(new Date().toISOString().slice(0, 10));
      }
      setCustomMap(loadCustomCats());
      setAdding(false); setNewCat("");
    }
  }, [open, editTxn]);

  const custom = customMap[type];
  const builtIns = BUILTIN_CATS[type];
  const allCats = [...builtIns, ...custom];

  // When type switches, ensure selected category belongs to that type
  useEffect(() => {
    if (!allCats.includes(category)) setCategory(allCats[0] ?? "");
    setAdding(false); setNewCat("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const addCategory = () => {
    const name = newCat.trim();
    if (!name) { toast.error(t("ক্যাটাগরির নাম দিন", "Enter category name")); return; }
    if (allCats.includes(name)) { toast.error(t("এই ক্যাটাগরি ইতিমধ্যে আছে", "Category already exists")); return; }
    const nextMap = { ...customMap, [type]: [...custom, name] };
    setCustomMap(nextMap); saveCustomCats(nextMap);
    setCategory(name);
    setNewCat(""); setAdding(false);
    toast.success(t("ক্যাটাগরি যুক্ত হয়েছে", "Category added"));
  };

  const removeCustom = (name: string) => {
    const nextMap = { ...customMap, [type]: custom.filter((c) => c !== name) };
    setCustomMap(nextMap); saveCustomCats(nextMap);
    if (category === name) setCategory(nextMap[type][0] ?? "");
  };

  const save = async () => {
    if (busy) return;
    if (!category) { toast.error(t("ক্যাটাগরি দিন", "Select category")); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error(t("সঠিক পরিমাণ দিন", "Enter a valid amount")); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error(t("লগইন প্রয়োজন", "Sign-in required")); setBusy(false); return; }
    const payload = { type, category, amount: amt, occurred_on: date, note: note || null };
    const { error } = editTxn
      ? await supabase.from("transactions").update(payload).eq("id", editTxn.id)
      : await supabase.from("transactions").insert({ user_id: user.id, ...payload });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editTxn ? t("আপডেট হয়েছে", "Updated") : t("লেনদেন যুক্ত হয়েছে", "Transaction added"));
    qc.invalidateQueries({ queryKey: ["transactions"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editTxn ? t("লেনদেন এডিট", "Edit transaction") : t("নতুন লেনদেন", "New transaction")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setType("income")} className={`py-2 rounded-lg border text-sm font-medium ${type === "income" ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "border-slate-200 text-slate-600"}`}>{t("আয়", "Income")}</button>
            <button onClick={() => setType("expense")} className={`py-2 rounded-lg border text-sm font-medium ${type === "expense" ? "bg-rose-50 border-rose-300 text-rose-700" : "border-slate-200 text-slate-600"}`}>{t("ব্যয়", "Expense")}</button>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-600">{t("ক্যাটাগরি", "Category")}</label>
              <button type="button" onClick={() => setAdding((v) => !v)} className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                <Plus className="w-3 h-3" /> {t("নতুন ক্যাটাগরি", "New category")}
              </button>
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
              {builtIns.map((k) => <option key={k} value={k}>{k}</option>)}
              {custom.length > 0 && <optgroup label={t("আমার ক্যাটাগরি", "My categories")}>
                {custom.map((c) => <option key={c} value={c}>{c}</option>)}
              </optgroup>}
            </select>
            {adding && (
              <div className="flex gap-2 mt-2">
                <input
                  autoFocus
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
                  placeholder={t("যেমন: যাতায়াত", "e.g. Transport")}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
                <button type="button" onClick={addCategory} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm">{t("যোগ", "Add")}</button>
              </div>
            )}
            {custom.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {custom.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs">
                    {c}
                    <button type="button" onClick={() => removeCustom(c)} className="text-slate-400 hover:text-rose-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-slate-600 mb-1 block">{t("পরিমাণ (৳)", "Amount (৳)")}</label>
            <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="0.00" />
          </div>
          <div>
            <label className="text-xs text-slate-600 mb-1 block">{t("তারিখ", "Date")}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-600 mb-1 block">{t("নোট (ঐচ্ছিক)", "Note (optional)")}</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => onOpenChange(false)} disabled={busy} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-50">{t("বাতিল", "Cancel")}</button>
            <button onClick={save} disabled={busy} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {busy ? t("সেভ হচ্ছে...", "Saving...") : t("সেভ", "Save")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}