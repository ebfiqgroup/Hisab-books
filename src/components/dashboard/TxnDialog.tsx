import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CATEGORIES } from "@/lib/finance";
import { Plus, X } from "lucide-react";

const LS_KEY = "custom_categories_v1";
const loadCustom = (): string[] => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
};
const saveCustom = (list: string[]) => localStorage.setItem(LS_KEY, JSON.stringify(list));

export function TxnDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("খাবার");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState("");

  useEffect(() => {
    if (open) {
      setType("expense"); setCategory("খাবার"); setAmount(""); setNote("");
      setDate(new Date().toISOString().slice(0, 10));
      setCustom(loadCustom());
      setAdding(false); setNewCat("");
    }
  }, [open]);

  const allCats = [...CATEGORIES.map((c) => c.key), ...custom];

  const addCategory = () => {
    const name = newCat.trim();
    if (!name) { toast.error("ক্যাটাগরির নাম দিন"); return; }
    if (allCats.includes(name)) { toast.error("এই ক্যাটাগরি ইতিমধ্যে আছে"); return; }
    const next = [...custom, name];
    setCustom(next); saveCustom(next);
    setCategory(name);
    setNewCat(""); setAdding(false);
    toast.success("ক্যাটাগরি যুক্ত হয়েছে");
  };

  const removeCustom = (name: string) => {
    const next = custom.filter((c) => c !== name);
    setCustom(next); saveCustom(next);
    if (category === name) setCategory("খাবার");
  };

  const save = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error("সঠিক পরিমাণ দিন"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("লগইন প্রয়োজন"); setBusy(false); return; }
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id, type, category, amount: amt, occurred_on: date, note: note || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("লেনদেন যুক্ত হয়েছে");
    qc.invalidateQueries({ queryKey: ["transactions"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>নতুন লেনদেন</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setType("income")} className={`py-2 rounded-lg border text-sm font-medium ${type === "income" ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "border-slate-200 text-slate-600"}`}>আয়</button>
            <button onClick={() => setType("expense")} className={`py-2 rounded-lg border text-sm font-medium ${type === "expense" ? "bg-rose-50 border-rose-300 text-rose-700" : "border-slate-200 text-slate-600"}`}>ব্যয়</button>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-600">ক্যাটাগরি</label>
              <button type="button" onClick={() => setAdding((v) => !v)} className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                <Plus className="w-3 h-3" /> নতুন ক্যাটাগরি
              </button>
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
              {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.key}</option>)}
              {custom.length > 0 && <optgroup label="আমার ক্যাটাগরি">
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
                  placeholder="যেমন: যাতায়াত"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
                <button type="button" onClick={addCategory} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm">যোগ</button>
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
            <label className="text-xs text-slate-600 mb-1 block">পরিমাণ (৳)</label>
            <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="0.00" />
          </div>
          <div>
            <label className="text-xs text-slate-600 mb-1 block">তারিখ</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-600 mb-1 block">নোট (ঐচ্ছিক)</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => onOpenChange(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">বাতিল</button>
            <button onClick={save} disabled={busy} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">সেভ</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}