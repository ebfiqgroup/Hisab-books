import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { CATEGORIES, fmtTk, toBn, monthBounds, categoryColor } from "@/lib/finance";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/budget")({ component: BudgetPage });

type Budget = { id: string; category: string; monthly_limit: number };
type Txn = { type: "income" | "expense"; category: string; amount: number; occurred_on: string };

function BudgetPage() {
  const qc = useQueryClient();
  const { startISO, endISO } = monthBounds();
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
    queryKey: ["transactions", "budget-month", startISO],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("type,category,amount,occurred_on").eq("type", "expense").gte("occurred_on", startISO).lt("occurred_on", endISO);
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

  return (
    <AppShell title="মাসিক বাজেট">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-medium">ক্যাটাগরি</th>
              <th className="text-right px-4 py-3 font-medium">বাজেট</th>
              <th className="text-right px-4 py-3 font-medium">এই মাসে ব্যয়</th>
              <th className="px-4 py-3 font-medium">অগ্রগতি</th>
              <th className="px-4 py-3 font-medium text-right">এডিট</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((c) => {
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
                      <button onClick={() => setDrafts({ ...drafts, [c.key]: String(limit || "") })} className="px-2 py-1 text-xs border border-slate-200 rounded-md hover:bg-slate-50">এডিট</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}