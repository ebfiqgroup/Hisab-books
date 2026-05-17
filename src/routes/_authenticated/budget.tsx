import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { fmtTk, toBn, monthBounds, categoryColor } from "@/lib/finance";
import { useCustomCategories } from "@/hooks/useCustomCategories";
import { toast } from "sonner";
import { Wallet, Trash2, CalendarRange } from "lucide-react";

export const Route = createFileRoute("/_authenticated/budget")({ component: BudgetPage });

type Budget = { id: string; category: string; monthly_limit: number };
type Txn = { type: "income" | "expense"; category: string; amount: number; occurred_on: string };

function BudgetPage() {
  const qc = useQueryClient();
  const { forType } = useCustomCategories();
  const { startISO: mStart, endISO: mEnd } = monthBounds();
  const [fromDate, setFromDate] = useState<string>(mStart);
  // monthBounds endISO is exclusive (1st of next month). For the input default,
  // show the last day of the current month inclusively.
  const lastDayOfMonth = useMemo(() => {
    const d = new Date(mEnd);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, [mEnd]);
  const [toDate, setToDate] = useState<string>(lastDayOfMonth);

  // For the query we need an exclusive upper bound (toDate + 1 day).
  const toExclusive = useMemo(() => {
    const d = new Date(toDate);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, [toDate]);

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const bQ = useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("budgets").select("id,category,monthly_limit");
      if (error) throw error;
      return (data ?? []) as Budget[];
    },
  });
  const tQ = useQuery({
    queryKey: ["transactions", "budget-range", fromDate, toExclusive],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("type,category,amount,occurred_on").eq("type", "expense").gte("occurred_on", fromDate).lt("occurred_on", toExclusive);
      if (error) throw error;
      return (data ?? []) as Txn[];
    },
  });

  const budgetMap = new Map((bQ.data ?? []).map((b) => [b.category, b]));
  const spentMap = new Map<string, number>();
  (tQ.data ?? []).forEach((t) => spentMap.set(t.category, (spentMap.get(t.category) ?? 0) + Number(t.amount)));

  const save = async (category: string) => {
    const raw = drafts[category];
    const amt = parseFloat(raw);
    if (Number.isNaN(amt) || amt < 0) { toast.error("সঠিক পরিমাণ দিন"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const existing = budgetMap.get(category);
    const { error } = existing
      ? await supabase.from("budgets").update({ monthly_limit: amt }).eq("id", existing.id)
      : await supabase.from("budgets").insert({ user_id: user.id, category, monthly_limit: amt });
    if (error) { toast.error(error.message); return; }
    toast.success("বাজেট সংরক্ষিত");
    setDrafts((d) => { const n = { ...d }; delete n[category]; return n; });
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };

  const removeBudget = async (category: string) => {
    const existing = budgetMap.get(category);
    if (!existing) return;
    if (!confirm("বাজেট মুছে ফেলবেন?")) return;
    const { error } = await supabase.from("budgets").delete().eq("id", existing.id);
    if (error) { toast.error(error.message); return; }
    toast.success("মুছে ফেলা হয়েছে");
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };

  const cats = forType("expense");
  const totalBudget = cats.reduce((s, k) => s + (budgetMap.get(k)?.monthly_limit ?? 0), 0);
  const totalSpent = cats.reduce((s, k) => s + (spentMap.get(k) ?? 0), 0);
  const totalPct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;

  const fmtBnDate = (iso: string) => {
    const d = new Date(iso);
    const bnMonths = ["জানু", "ফেব", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগ", "সেপ্ট", "অক্টো", "নভে", "ডিসে"];
    return `${toBn(d.getDate())} ${bnMonths[d.getMonth()]}, ${toBn(d.getFullYear())}`;
  };
  const dayCount = Math.max(1, Math.round((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000) + 1);

  return (
    <AppShell title="মাসিক বাজেট">
      <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200 mb-4">
        <div className="flex items-center gap-2 mb-2 text-sm text-slate-600">
          <CalendarRange className="w-4 h-4 text-indigo-600" />
          <span className="font-medium">তারিখ ফিল্টার</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">শুরু</label>
            <input type="date" value={fromDate} max={toDate} onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">শেষ</label>
            <input type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setFromDate(mStart); setToDate(lastDayOfMonth); }}
              className="px-3 py-2 text-xs border border-slate-200 rounded-md hover:bg-slate-50">এই মাস</button>
            <button onClick={() => {
              const now = new Date();
              const s = new Date(now.getFullYear(), 0, 1);
              const e = new Date(now.getFullYear(), 11, 31);
              setFromDate(s.toISOString().slice(0, 10));
              setToDate(e.toISOString().slice(0, 10));
            }} className="px-3 py-2 text-xs border border-slate-200 rounded-md hover:bg-slate-50">এই বছর</button>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 mb-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-slate-500">নির্বাচিত সময়ে ব্যয় / মোট বাজেট</div>
            <div className="text-lg sm:text-xl font-bold text-slate-800 truncate">
              <span className={totalSpent > totalBudget && totalBudget > 0 ? "text-rose-500" : "text-indigo-600"}>{fmtTk(totalSpent)}</span>
              <span className="text-slate-400 text-sm font-medium"> / {fmtTk(totalBudget)}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
              <div className={`h-full ${totalSpent > totalBudget && totalBudget > 0 ? "bg-rose-500" : "bg-indigo-500"}`} style={{ width: `${totalPct}%` }} />
            </div>
          </div>
        </div>
      </div>
      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-medium">ক্যাটাগরি</th>
              <th className="text-right px-4 py-3 font-medium">বাজেট</th>
              <th className="text-right px-4 py-3 font-medium">ব্যয় (নির্বাচিত)</th>
              <th className="px-4 py-3 font-medium">অগ্রগতি</th>
              <th className="px-4 py-3 font-medium text-right">অ্যাকশন</th>
            </tr>
          </thead>
          <tbody>
            {cats.map((key) => {
              const c = { key };
              const b = budgetMap.get(c.key);
              const limit = b?.monthly_limit ?? 0;
              const spent = spentMap.get(c.key) ?? 0;
              const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
              const over = limit > 0 && spent > limit;
              const draft = drafts[c.key];
              return (
                <tr key={c.key} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-700">
                    <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{ background: categoryColor(c.key) }}></span>
                    {c.key}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {draft !== undefined ? (
                      <input autoFocus type="number" value={draft} onChange={(e) => setDrafts({ ...drafts, [c.key]: e.target.value })}
                        className="w-28 px-2 py-1 border border-slate-200 rounded-md text-right" placeholder="0" />
                    ) : <span className="font-medium text-slate-800">{limit > 0 ? fmtTk(limit) : <span className="text-slate-400">—</span>}</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">{fmtTk(spent)}</td>
                  <td className="px-4 py-3 w-64">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${over ? "bg-rose-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }}></div>
                    </div>
                    <div className={`text-xs mt-1 ${over ? "text-rose-500" : "text-slate-500"}`}>{toBn(pct.toFixed(0))}%</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {draft !== undefined ? (
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setDrafts((d) => { const n = { ...d }; delete n[c.key]; return n; })} className="px-2 py-1 text-xs border border-slate-200 rounded-md">বাতিল</button>
                        <button onClick={() => save(c.key)} className="px-2 py-1 text-xs bg-indigo-600 text-white rounded-md">সেভ</button>
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setDrafts({ ...drafts, [c.key]: String(limit || "") })} className="px-2 py-1 text-xs border border-slate-200 rounded-md hover:bg-slate-50">{limit > 0 ? "এডিট" : "সেট"}</button>
                        {limit > 0 && (
                          <button onClick={() => removeBudget(c.key)} className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600" title="মুছুন">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {cats.map((key) => {
          const b = budgetMap.get(key);
          const limit = b?.monthly_limit ?? 0;
          const spent = spentMap.get(key) ?? 0;
          const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
          const over = limit > 0 && spent > limit;
          const draft = drafts[key];
          return (
            <div key={key} className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: categoryColor(key) }}></span>
                  <span className="font-medium text-slate-800 text-sm truncate">{key}</span>
                </div>
                <div className="text-xs text-slate-500 whitespace-nowrap">
                  <span className={over ? "text-rose-500 font-bold" : "text-slate-700 font-medium"}>{fmtTk(spent)}</span>
                  <span className="text-slate-400"> / {limit > 0 ? fmtTk(limit) : "—"}</span>
                </div>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                <div className={`h-full ${over ? "bg-rose-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }}></div>
              </div>
              {draft !== undefined ? (
                <div className="flex gap-2">
                  <input autoFocus type="number" value={draft} onChange={(e) => setDrafts({ ...drafts, [key]: e.target.value })}
                    className="flex-1 px-2 py-1.5 border border-slate-200 rounded-md text-sm" placeholder="বাজেট পরিমাণ" />
                  <button onClick={() => setDrafts((d) => { const n = { ...d }; delete n[key]; return n; })} className="px-3 py-1.5 text-xs border border-slate-200 rounded-md">বাতিল</button>
                  <button onClick={() => save(key)} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md">সেভ</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setDrafts({ ...drafts, [key]: String(limit || "") })} className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50">{limit > 0 ? "এডিট" : "বাজেট সেট"}</button>
                  {limit > 0 && (
                    <button onClick={() => removeBudget(key)} className="p-2 rounded-md border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600" title="মুছুন">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}