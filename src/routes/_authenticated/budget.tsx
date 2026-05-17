import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { fmtTk, toBn, categoryColor } from "@/lib/finance";
import { useCustomCategories } from "@/hooks/useCustomCategories";
import { loadCustomCats, saveCustomCats } from "@/lib/finance";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Wallet, CalendarClock, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/budget")({ component: BudgetPage });

type Budget = {
  id: string;
  category: string;
  monthly_limit: number;
  label: string | null;
  start_at: string;
  end_at: string;
};
type Txn = { category: string; amount: number; occurred_on: string };

const BN_MONTHS_SHORT = ["জানু", "ফেব", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগ", "সেপ্ট", "অক্টো", "নভে", "ডিসে"];
const fmtBnDateTime = (iso: string) => {
  const d = new Date(iso);
  const date = `${toBn(d.getDate())} ${BN_MONTHS_SHORT[d.getMonth()]}, ${toBn(d.getFullYear())}`;
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const time = `${toBn(h)}:${toBn(String(m).padStart(2, "0"))} ${ampm}`;
  return `${date} · ${time}`;
};

// Convert Date <-> input[type="datetime-local"] value (in local time, no TZ)
const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (s: string) => new Date(s).toISOString();

type FormState = {
  id?: string;
  label: string;
  category: string;
  amount: string;
  start: string; // datetime-local value
  end: string;
};

function emptyForm(defaultCat: string): FormState {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes());
  return { label: "", category: defaultCat, amount: "", start: toLocalInput(now), end: toLocalInput(end) };
}

function BudgetPage() {
  const qc = useQueryClient();
  const { forType } = useCustomCategories();
  // One-time clear of any pre-existing expense categories so the budget
  // page starts fresh and the user defines categories from scratch here.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("budget_cats_reset_v1")) return;
    const m = loadCustomCats();
    saveCustomCats({ ...m, expense: [] });
    localStorage.setItem("budget_cats_reset_v1", "1");
  }, []);
  const cats = forType("expense");
  const [newCat, setNewCat] = useState("");
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");

  const addCategory = (raw: string) => {
    const name = raw.trim();
    if (!name) { toast.error("ক্যাটাগরির নাম দিন"); return null; }
    const m = loadCustomCats();
    if (m.expense.includes(name)) { toast.error("এই ক্যাটাগরি ইতোমধ্যে আছে"); return name; }
    saveCustomCats({ ...m, expense: [...m.expense, name] });
    toast.success("ক্যাটাগরি যুক্ত হয়েছে");
    return name;
  };

  const renameCategory = async (oldName: string, rawNew: string) => {
    const newName = rawNew.trim();
    if (!newName) { toast.error("নাম খালি হতে পারবে না"); return; }
    if (newName === oldName) { setEditingCat(null); return; }
    const m = loadCustomCats();
    if (m.expense.includes(newName)) { toast.error("এই নাম ইতোমধ্যে আছে"); return; }
    saveCustomCats({ ...m, expense: m.expense.map((c) => (c === oldName ? newName : c)) });
    // Update affected budgets in DB
    const { error } = await supabase.from("budgets").update({ category: newName }).eq("category", oldName);
    if (error) { toast.error(error.message); return; }
    if (form.category === oldName) setForm({ ...form, category: newName });
    setEditingCat(null);
    toast.success("ক্যাটাগরি আপডেট হয়েছে");
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };

  const deleteCategory = async (name: string) => {
    const used = (bQ.data ?? []).some((b) => b.category === name);
    const msg = used
      ? `"${name}" ক্যাটাগরি ব্যবহৃত হচ্ছে এমন বাজেটসহ মুছে ফেলবেন?`
      : `"${name}" ক্যাটাগরি মুছে ফেলবেন?`;
    if (!confirm(msg)) return;
    if (used) {
      const { error } = await supabase.from("budgets").delete().eq("category", name);
      if (error) { toast.error(error.message); return; }
    }
    const m = loadCustomCats();
    saveCustomCats({ ...m, expense: m.expense.filter((c) => c !== name) });
    if (form.category === name) setForm({ ...form, category: "" });
    toast.success("ক্যাটাগরি মুছে ফেলা হয়েছে");
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm(cats[0] ?? ""));

  const bQ = useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budgets")
        .select("id,category,monthly_limit,label,start_at,end_at")
        .order("start_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Budget[];
    },
  });

  // Pull all expense txns in the union range of all budgets (or last 365 days as fallback)
  const range = useMemo(() => {
    const list = bQ.data ?? [];
    if (list.length === 0) {
      const now = new Date();
      const past = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      return { from: past.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
    }
    let min = list[0].start_at, max = list[0].end_at;
    for (const b of list) {
      if (b.start_at < min) min = b.start_at;
      if (b.end_at > max) max = b.end_at;
    }
    return { from: min.slice(0, 10), to: max.slice(0, 10) };
  }, [bQ.data]);

  const tQ = useQuery({
    queryKey: ["transactions", "budget-union", range.from, range.to],
    enabled: !!bQ.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("category,amount,occurred_on")
        .eq("type", "expense")
        .gte("occurred_on", range.from)
        .lte("occurred_on", range.to);
      if (error) throw error;
      return (data ?? []) as Txn[];
    },
  });

  const spentFor = (b: Budget) => {
    const sIso = b.start_at.slice(0, 10);
    const eIso = b.end_at.slice(0, 10);
    return (tQ.data ?? [])
      .filter((t) => t.category === b.category && t.occurred_on >= sIso && t.occurred_on <= eIso)
      .reduce((s, t) => s + Number(t.amount), 0);
  };

  const openCreate = () => {
    setForm(emptyForm(cats[0] ?? ""));
    setOpen(true);
  };
  const openEdit = (b: Budget) => {
    setForm({
      id: b.id,
      label: b.label ?? "",
      category: b.category,
      amount: String(b.monthly_limit),
      start: toLocalInput(new Date(b.start_at)),
      end: toLocalInput(new Date(b.end_at)),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.category) { toast.error("ক্যাটাগরি দিন"); return; }
    const amt = parseFloat(form.amount);
    if (Number.isNaN(amt) || amt < 0) { toast.error("সঠিক পরিমাণ দিন"); return; }
    if (!form.start || !form.end) { toast.error("শুরু ও শেষ সময় দিন"); return; }
    if (new Date(form.end) <= new Date(form.start)) { toast.error("শেষ সময় শুরুর পরে হতে হবে"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = {
      label: form.label.trim() || null,
      category: form.category,
      monthly_limit: amt,
      start_at: fromLocalInput(form.start),
      end_at: fromLocalInput(form.end),
    };
    const { error } = form.id
      ? await supabase.from("budgets").update(payload).eq("id", form.id)
      : await supabase.from("budgets").insert({ ...payload, user_id: user.id });
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "আপডেট হয়েছে" : "বাজেট যুক্ত হয়েছে");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };

  const remove = async (id: string) => {
    if (!confirm("বাজেট মুছে ফেলবেন?")) return;
    const { error } = await supabase.from("budgets").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("মুছে ফেলা হয়েছে");
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };

  const list = bQ.data ?? [];
  const totalLimit = list.reduce((s, b) => s + Number(b.monthly_limit), 0);
  const totalSpent = list.reduce((s, b) => s + spentFor(b), 0);
  const totalPct = totalLimit > 0 ? Math.min(100, (totalSpent / totalLimit) * 100) : 0;

  return (
    <AppShell title="বাজেট">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">আমার বাজেট</h2>
          <p className="text-xs text-slate-500">কাস্টম তারিখ ও সময় রেঞ্জ সহ বাজেট পরিচালনা</p>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg shadow-sm">
          <Plus className="w-4 h-4" /> নতুন বাজেট
        </button>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 mb-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-slate-500">মোট ব্যয় / মোট বাজেট</div>
            <div className="text-lg sm:text-xl font-bold text-slate-800 truncate">
              <span className={totalSpent > totalLimit && totalLimit > 0 ? "text-rose-500" : "text-indigo-600"}>{fmtTk(totalSpent)}</span>
              <span className="text-slate-400 text-sm font-medium"> / {fmtTk(totalLimit)}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
              <div className={`h-full ${totalSpent > totalLimit && totalLimit > 0 ? "bg-rose-500" : "bg-indigo-500"}`} style={{ width: `${totalPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      {list.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <Wallet className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-600 text-sm mb-3">এখনো কোনো বাজেট নেই</p>
          <button onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg">
            <Plus className="w-4 h-4" /> প্রথম বাজেট যুক্ত করুন
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {list.map((b) => {
            const spent = spentFor(b);
            const pct = b.monthly_limit > 0 ? Math.min(100, (spent / b.monthly_limit) * 100) : 0;
            const over = b.monthly_limit > 0 && spent > b.monthly_limit;
            return (
              <div key={b.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: categoryColor(b.category) }} />
                      <span className="font-semibold text-slate-800 truncate">{b.label || b.category}</span>
                    </div>
                    {b.label && <div className="text-xs text-slate-500 ml-4.5">ক্যাটাগরি: {b.category}</div>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(b)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500" title="এডিট">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(b.id)} className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600" title="মুছুন">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                  <CalendarClock className="w-3.5 h-3.5" />
                  <span className="truncate">{fmtBnDateTime(b.start_at)} → {fmtBnDateTime(b.end_at)}</span>
                </div>

                <div className="flex items-baseline justify-between mb-1.5">
                  <span className={`text-sm font-semibold ${over ? "text-rose-500" : "text-slate-800"}`}>{fmtTk(spent)}</span>
                  <span className="text-xs text-slate-500">/ {fmtTk(b.monthly_limit)}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${over ? "bg-rose-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
                </div>
                <div className={`text-xs mt-1 ${over ? "text-rose-500" : "text-slate-500"}`}>{toBn(pct.toFixed(0))}% ব্যবহৃত</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4" onClick={() => setOpen(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">{form.id ? "বাজেট এডিট" : "নতুন বাজেট"}</h3>
              <button onClick={() => setOpen(false)} className="p-1 rounded-md hover:bg-slate-100 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">লেবেল (ঐচ্ছিক)</label>
                <input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="যেমন: রমজানের খাবার"
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">ক্যাটাগরি</label>
                <div className="flex gap-2">
                  <input type="text" value={newCat} onChange={(e) => setNewCat(e.target.value)}
                    placeholder="নতুন ক্যাটাগরির নাম"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const added = addCategory(newCat);
                        if (added) { setForm({ ...form, category: added }); setNewCat(""); }
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-md text-sm" />
                  <button type="button" onClick={() => {
                    const added = addCategory(newCat);
                    if (added) { setForm({ ...form, category: added }); setNewCat(""); }
                  }} className="px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-md inline-flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> যোগ
                  </button>
                </div>
                {cats.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {cats.map((c) => {
                      const isEditing = editingCat === c;
                      const isSelected = form.category === c;
                      if (isEditing) {
                        return (
                          <div key={c} className="inline-flex items-center gap-1 border border-indigo-300 rounded-full pl-2 pr-1 py-0.5 bg-white">
                            <input
                              autoFocus
                              value={editingCatName}
                              onChange={(e) => setEditingCatName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); renameCategory(c, editingCatName); }
                                if (e.key === "Escape") setEditingCat(null);
                              }}
                              className="text-xs w-24 outline-none bg-transparent"
                            />
                            <button type="button" onClick={() => renameCategory(c, editingCatName)}
                              className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-600 text-white">ঠিক</button>
                            <button type="button" onClick={() => setEditingCat(null)}
                              className="p-0.5 text-slate-400 hover:text-slate-600"><X className="w-3 h-3" /></button>
                          </div>
                        );
                      }
                      return (
                        <div key={c}
                          className={`inline-flex items-center rounded-full border text-xs ${isSelected ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 text-slate-700"}`}>
                          <button type="button" onClick={() => setForm({ ...form, category: c })}
                            className={`pl-2.5 pr-1.5 py-1 ${isSelected ? "" : "hover:bg-slate-50 rounded-l-full"}`}>
                            <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: categoryColor(c) }} />
                            {c}
                          </button>
                          <button type="button" title="এডিট"
                            onClick={() => { setEditingCat(c); setEditingCatName(c); }}
                            className={`p-1 ${isSelected ? "text-indigo-100 hover:text-white" : "text-slate-400 hover:text-slate-700"}`}>
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button type="button" title="মুছুন"
                            onClick={() => deleteCategory(c)}
                            className={`p-1 pr-2 ${isSelected ? "text-indigo-100 hover:text-white" : "text-slate-400 hover:text-rose-600"}`}>
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {!form.category && (
                  <p className="text-xs text-rose-500 mt-1">একটি ক্যাটাগরি বেছে নিন বা নতুন তৈরি করুন</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">পরিমাণ (৳)</label>
                <input type="number" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">শুরু (তারিখ ও সময়)</label>
                  <input type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">শেষ (তারিখ ও সময়)</label>
                  <input type="datetime-local" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { label: "৭ দিন", days: 7 },
                  { label: "৩০ দিন", days: 30 },
                  { label: "৯০ দিন", days: 90 },
                  { label: "১ বছর", days: 365 },
                ].map((p) => (
                  <button key={p.days} type="button" onClick={() => {
                    const s = new Date();
                    const e = new Date(s.getTime() + p.days * 86400000);
                    setForm({ ...form, start: toLocalInput(s), end: toLocalInput(e) });
                  }} className="px-2.5 py-1 text-xs border border-slate-200 rounded-full hover:bg-slate-50">
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setOpen(false)} className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50">বাতিল</button>
              <button onClick={save} disabled={!form.category}
                className="flex-1 px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-md">
                {form.id ? "আপডেট" : "যুক্ত করুন"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}