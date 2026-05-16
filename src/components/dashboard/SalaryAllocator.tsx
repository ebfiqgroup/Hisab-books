import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Check, X, RotateCcw, Wallet } from "lucide-react";
import { fmtTk, toBn } from "@/lib/finance";

type Rule = { id: string; category: string; percent: number };

const LS_KEY = "salary_allocation_rules_v1";

const DEFAULT_RULES: Rule[] = [
  { id: "self",     category: "নিজের",   percent: 7 },
  { id: "family",   category: "ফ্যামিলি", percent: 10 },
  { id: "sadaqa",   category: "সদকা",    percent: 5 },
  { id: "urgent",   category: "জরুরি",   percent: 3 },
  { id: "savings",  category: "সঞ্চয়",   percent: 5 },
  { id: "business", category: "ব্যবসা",  percent: 70 },
];

const loadRules = (): Rule[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    if (Array.isArray(raw) && raw.every((r) => r && typeof r.id === "string")) return raw;
  } catch { /* ignore */ }
  return DEFAULT_RULES;
};
const saveRules = (r: Rule[]) => localStorage.setItem(LS_KEY, JSON.stringify(r));
const uid = () => Math.random().toString(36).slice(2, 10);

export function SalaryAllocator() {
  const qc = useQueryClient();
  const [rules, setRules] = useState<Rule[]>(() => loadRules());
  const [salary, setSalary] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftCat, setDraftCat] = useState("");
  const [draftPct, setDraftPct] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { saveRules(rules); }, [rules]);

  const base = Number(salary) || 0;
  const totalPct = useMemo(() => rules.reduce((s, r) => s + r.percent, 0), [rules]);
  const totalAmt = useMemo(() => rules.reduce((s, r) => s + (base * r.percent) / 100, 0), [rules, base]);

  const startEdit = (r: Rule) => { setEditingId(r.id); setDraftCat(r.category); setDraftPct(String(r.percent)); };
  const cancelEdit = () => { setEditingId(null); setDraftCat(""); setDraftPct(""); };

  const saveEdit = (id: string) => {
    const cat = draftCat.trim();
    const pct = Number(draftPct);
    if (!cat) { toast.error("ক্যাটাগরির নাম দিন"); return; }
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) { toast.error("শতকরা ০-১০০ এর মধ্যে দিন"); return; }
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, category: cat, percent: pct } : r)));
    cancelEdit();
  };

  const removeRule = (id: string) => {
    if (!confirm("এই বণ্টন নিয়ম মুছবেন?")) return;
    setRules((rs) => rs.filter((r) => r.id !== id));
  };

  const addRule = () => {
    const cat = draftCat.trim();
    const pct = Number(draftPct);
    if (!cat) { toast.error("ক্যাটাগরির নাম দিন"); return; }
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) { toast.error("শতকরা ০-১০০ এর মধ্যে দিন"); return; }
    setRules((rs) => [...rs, { id: uid(), category: cat, percent: pct }]);
    setAdding(false); setDraftCat(""); setDraftPct("");
  };

  const resetDefaults = () => {
    if (!confirm("ডিফল্ট বণ্টনে ফিরিয়ে আনবেন?")) return;
    setRules(DEFAULT_RULES);
  };

  const applyAllocation = async () => {
    if (base <= 0) { toast.error("বেতন দিন"); return; }
    if (rules.length === 0) { toast.error("কোনো বণ্টন নিয়ম নেই"); return; }
    if (!confirm(`মোট ${fmtTk(totalAmt)} ব্যয় হিসেবে যোগ হবে। চালিয়ে যাবেন?`)) return;
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const user_id = u?.user?.id;
    if (!user_id) { setBusy(false); toast.error("লগইন প্রয়োজন"); return; }
    const today = new Date().toISOString().slice(0, 10);
    const rows = rules
      .filter((r) => r.percent > 0)
      .map((r) => ({
        user_id,
        type: "expense" as const,
        category: r.category,
        amount: Math.round((base * r.percent) / 100),
        occurred_on: today,
        note: `অটো-বণ্টন (${toBn(r.percent)}%)`,
      }));
    const { error } = await supabase.from("transactions").insert(rows);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${toBn(rows.length)}টি বণ্টন যোগ হয়েছে`);
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <div className="text-base font-semibold text-slate-800">বেতন অটো-বণ্টন</div>
            <div className="text-xs text-slate-500">বেতন দিন, খাত অনুযায়ী স্বয়ংক্রিয় বণ্টন দেখুন ও প্রয়োগ করুন</div>
          </div>
        </div>
        <button onClick={resetDefaults} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-600">
          <RotateCcw className="w-3.5 h-3.5" /> ডিফল্ট
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <label className="text-sm text-slate-600 shrink-0">বেতন (৳):</label>
        <input
          type="number"
          min={0}
          value={salary}
          onChange={(e) => setSalary(e.target.value)}
          placeholder="যেমন: 50000"
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden mb-3">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs">
            <tr>
              <th className="text-left px-3 py-2 font-medium">খাত</th>
              <th className="text-right px-3 py-2 font-medium w-20">%</th>
              <th className="text-right px-3 py-2 font-medium">পরিমাণ</th>
              <th className="px-3 py-2 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 && (
              <tr><td colSpan={4} className="text-center text-slate-400 py-4 text-xs">কোনো বণ্টন নিয়ম নেই</td></tr>
            )}
            {rules.map((r) => {
              const amt = (base * r.percent) / 100;
              const isEditing = editingId === r.id;
              return (
                <tr key={r.id} className="border-t border-slate-100">
                  {isEditing ? (
                    <>
                      <td className="px-3 py-2">
                        <input autoFocus value={draftCat} onChange={(e) => setDraftCat(e.target.value)} className="w-full px-2 py-1 border border-slate-200 rounded text-sm" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input type="number" min={0} max={100} value={draftPct} onChange={(e) => setDraftPct(e.target.value)} className="w-16 px-2 py-1 border border-slate-200 rounded text-sm text-right" />
                      </td>
                      <td className="px-3 py-2 text-right text-slate-400 text-xs">—</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => saveEdit(r.id)} className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-600" title="সেভ">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={cancelEdit} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500" title="বাতিল">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-slate-700">{r.category}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{toBn(r.percent)}%</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-800">{fmtTk(amt)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => startEdit(r)} className="p-1.5 rounded-md hover:bg-indigo-50 text-slate-400 hover:text-indigo-600" title="এডিট">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => removeRule(r.id)} className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600" title="মুছুন">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {adding && (
              <tr className="border-t border-slate-100 bg-slate-50/50">
                <td className="px-3 py-2">
                  <input autoFocus value={draftCat} onChange={(e) => setDraftCat(e.target.value)} placeholder="খাত" className="w-full px-2 py-1 border border-slate-200 rounded text-sm" />
                </td>
                <td className="px-3 py-2 text-right">
                  <input type="number" min={0} max={100} value={draftPct} onChange={(e) => setDraftPct(e.target.value)} placeholder="%" className="w-16 px-2 py-1 border border-slate-200 rounded text-sm text-right" />
                </td>
                <td className="px-3 py-2 text-right text-slate-400 text-xs">—</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={addRule} className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-600" title="যোগ">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setAdding(false); setDraftCat(""); setDraftPct(""); }} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500" title="বাতিল">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50">
              <td className="px-3 py-2 text-xs font-medium text-slate-600">মোট</td>
              <td className={`px-3 py-2 text-right text-xs font-semibold ${totalPct === 100 ? "text-emerald-600" : "text-amber-600"}`}>{toBn(totalPct)}%</td>
              <td className="px-3 py-2 text-right text-xs font-semibold text-slate-800">{fmtTk(totalAmt)}</td>
              <td className="px-3 py-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {totalPct !== 100 && (
        <div className="text-[11px] text-amber-600 mb-3">
          ⚠ মোট শতকরা {toBn(totalPct)}% — ১০০% হলে পুরো বেতন বণ্টন হবে।
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {!adding && (
          <button onClick={() => { setAdding(true); setDraftCat(""); setDraftPct(""); }} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700">
            <Plus className="w-4 h-4" /> নতুন খাত
          </button>
        )}
        <button onClick={applyAllocation} disabled={busy || base <= 0} className="ml-auto flex items-center gap-1.5 px-4 py-2 text-sm bg-rose-500 text-white rounded-lg hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed">
          {busy ? "প্রয়োগ হচ্ছে..." : "ব্যয় হিসেবে প্রয়োগ করুন"}
        </button>
      </div>
    </div>
  );
}