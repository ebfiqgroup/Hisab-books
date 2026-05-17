import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Check, X, RotateCcw, Wallet } from "lucide-react";
import { fmtTk, toBn, loadCustomCats, saveCustomCats, allCatsForType } from "@/lib/finance";

type Rule = { id: string; category: string; percent: number };

const LS_KEY = "salary_allocation_rules_v1";
const LS_AUTO = "salary_auto_monthly_v1";
const AUTO_DEFAULT_IDS = ["sadaqa", "urgent", "savings"];
type AutoCfg = { enabled: boolean; salary: number; ruleIds: string[]; lastMonth: string };
const loadAuto = (): AutoCfg => {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_AUTO) || "null");
    if (raw && typeof raw === "object") return { enabled: !!raw.enabled, salary: Number(raw.salary) || 0, ruleIds: Array.isArray(raw.ruleIds) ? raw.ruleIds : AUTO_DEFAULT_IDS, lastMonth: typeof raw.lastMonth === "string" ? raw.lastMonth : "" };
  } catch { /* ignore */ }
  return { enabled: false, salary: 0, ruleIds: AUTO_DEFAULT_IDS, lastMonth: "" };
};
const saveAuto = (a: AutoCfg) => localStorage.setItem(LS_AUTO, JSON.stringify(a));
const currentMonth = () => new Date().toISOString().slice(0, 7);

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
  const [auto, setAuto] = useState<AutoCfg>(() => loadAuto());

  useEffect(() => { saveRules(rules); }, [rules]);
  useEffect(() => { saveAuto(auto); }, [auto]);

  // Ensure a category exists in the expense category list; if not, add as custom.
  const ensureCategory = (cat: string) => {
    const map = loadCustomCats();
    const existing = allCatsForType("expense", map);
    if (existing.includes(cat)) return false;
    const next = { ...map, expense: [...map.expense, cat] };
    saveCustomCats(next);
    return true;
  };
  const ensureCategories = (cats: string[]) => {
    const map = loadCustomCats();
    const existing = new Set(allCatsForType("expense", map));
    const toAdd = cats.filter((c) => !existing.has(c));
    if (toAdd.length === 0) return 0;
    const next = { ...map, expense: [...map.expense, ...toAdd] };
    saveCustomCats(next);
    return toAdd.length;
  };

  // Run auto-allocation for selected ruleIds (used by monthly auto + manual)
  const runAuto = async (cfg: AutoCfg, opts: { silent?: boolean } = {}) => {
    const selected = rules.filter((r) => cfg.ruleIds.includes(r.id) && r.percent > 0);
    if (selected.length === 0 || cfg.salary <= 0) return false;
    const { data: u } = await supabase.auth.getUser();
    const user_id = u?.user?.id;
    if (!user_id) return false;
    ensureCategories(selected.map((r) => r.category));
    const today = new Date().toISOString().slice(0, 10);
    const rows = selected.map((r) => ({
      user_id,
      type: "expense" as const,
      category: r.category,
      amount: Math.round((cfg.salary * r.percent) / 100),
      occurred_on: today,
      note: `মাসিক অটো-বণ্টন (${toBn(r.percent)}%)`,
    }));
    const { error } = await supabase.from("transactions").insert(rows);
    if (error) { if (!opts.silent) toast.error(error.message); return false; }
    qc.invalidateQueries({ queryKey: ["transactions"] });
    if (!opts.silent) toast.success(`${toBn(rows.length)}টি মাসিক বণ্টন যোগ হয়েছে`);
    return true;
  };

  // Monthly auto-run: when enabled and current month not yet processed
  useEffect(() => {
    if (!auto.enabled) return;
    const m = currentMonth();
    if (auto.lastMonth === m) return;
    if (auto.salary <= 0) return;
    (async () => {
      const ok = await runAuto(auto, { silent: false });
      if (ok) setAuto((a) => ({ ...a, lastMonth: m }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto.enabled, auto.salary, auto.ruleIds.join(","), rules]);

  const base = Number(salary) || 0;
  const totalPct = useMemo(() => rules.reduce((s, r) => s + r.percent, 0), [rules]);
  const totalAmt = useMemo(() => rules.reduce((s, r) => s + (base * r.percent) / 100, 0), [rules, base]);

  // Live validation for draft percent input
  const draftPctNum = draftPct === "" ? NaN : Number(draftPct);
  const draftPctInvalid = draftPct !== "" && (!Number.isFinite(draftPctNum) || draftPctNum < 0 || draftPctNum > 100);
  // Projected total if current draft is applied (edit replaces, add appends)
  const projectedTotal = useMemo(() => {
    if (!editingId && !adding) return totalPct;
    const pct = Number.isFinite(draftPctNum) ? draftPctNum : 0;
    if (editingId) {
      const cur = rules.find((r) => r.id === editingId)?.percent ?? 0;
      return totalPct - cur + pct;
    }
    return totalPct + pct;
  }, [totalPct, editingId, adding, draftPctNum, rules]);
  const overLimit = projectedTotal > 100;

  const startEdit = (r: Rule) => { setEditingId(r.id); setDraftCat(r.category); setDraftPct(String(r.percent)); };
  const cancelEdit = () => { setEditingId(null); setDraftCat(""); setDraftPct(""); };

  const saveEdit = (id: string) => {
    const cat = draftCat.trim();
    const pct = Number(draftPct);
    if (!cat) { toast.error("ক্যাটাগরির নাম দিন"); return; }
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) { toast.error("শতকরা ০-১০০ এর মধ্যে দিন"); return; }
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, category: cat, percent: pct } : r)));
    if (ensureCategory(cat)) toast.success(`"${cat}" ক্যাটাগরি যোগ হয়েছে`);
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
    if (ensureCategory(cat)) toast.success(`"${cat}" ক্যাটাগরি যোগ হয়েছে`);
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
    // Auto-register any allocation category that isn't already in the expense list
    const added = ensureCategories(rules.filter((r) => r.percent > 0).map((r) => r.category));
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
    toast.success(
      added > 0
        ? `${toBn(rows.length)}টি বণ্টন ও ${toBn(added)}টি নতুন ক্যাটাগরি যোগ হয়েছে`
        : `${toBn(rows.length)}টি বণ্টন যোগ হয়েছে`,
    );
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

      {/* Monthly auto-allocation panel */}
      <div className="mb-4 p-3 rounded-lg border border-indigo-100 bg-indigo-50/40">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={auto.enabled}
            onChange={(e) => setAuto((a) => ({ ...a, enabled: e.target.checked, lastMonth: e.target.checked ? a.lastMonth : "" }))}
            className="w-4 h-4 accent-indigo-600"
          />
          <span className="text-sm font-medium text-slate-800">প্রতি মাসে অটো-বণ্টন চালু</span>
        </label>
        <div className="text-[11px] text-slate-500 mt-1 ml-6">প্রতি মাসে প্রথমবার পেজ খুললে নির্বাচিত খাতগুলো ব্যয় হিসেবে যোগ হবে</div>
        {auto.enabled && (
          <div className="mt-3 ml-6 space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-600 shrink-0 w-24">মাসিক বেতন (৳)</label>
              <input
                type="number"
                min={0}
                value={auto.salary || ""}
                onChange={(e) => setAuto((a) => ({ ...a, salary: Number(e.target.value) || 0 }))}
                placeholder="যেমন: 50000"
                className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">নির্বাচিত খাত:</div>
              <div className="flex flex-wrap gap-2">
                {rules.map((r) => {
                  const checked = auto.ruleIds.includes(r.id);
                  return (
                    <label key={r.id} className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs cursor-pointer ${checked ? "border-indigo-300 bg-white text-indigo-700" : "border-slate-200 bg-white text-slate-600"}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => setAuto((a) => ({ ...a, ruleIds: e.target.checked ? [...a.ruleIds, r.id] : a.ruleIds.filter((x) => x !== r.id) }))}
                        className="w-3 h-3 accent-indigo-600"
                      />
                      {r.category} ({toBn(r.percent)}%)
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500">
              <span>সর্বশেষ মাস: {auto.lastMonth ? toBn(auto.lastMonth) : "—"}</span>
              <button
                onClick={async () => {
                  if (auto.salary <= 0) { toast.error("বেতন দিন"); return; }
                  const ok = await runAuto(auto);
                  if (ok) setAuto((a) => ({ ...a, lastMonth: currentMonth() }));
                }}
                className="ml-auto px-2 py-1 rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >এখনই চালান</button>
              <button
                onClick={() => setAuto((a) => ({ ...a, lastMonth: "" }))}
                className="px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
              >মাস রিসেট</button>
            </div>
          </div>
        )}
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
                        <input type="number" min={0} max={100} value={draftPct} onChange={(e) => setDraftPct(e.target.value)} className={`w-16 px-2 py-1 border rounded text-sm text-right focus:outline-none focus:ring-1 ${draftPctInvalid ? "border-rose-400 ring-rose-300 bg-rose-50" : "border-slate-200 focus:ring-indigo-400"}`} />
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
                  <input type="number" min={0} max={100} value={draftPct} onChange={(e) => setDraftPct(e.target.value)} placeholder="%" className={`w-16 px-2 py-1 border rounded text-sm text-right focus:outline-none focus:ring-1 ${draftPctInvalid ? "border-rose-400 ring-rose-300 bg-rose-50" : "border-slate-200 focus:ring-indigo-400"}`} />
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
              <td className={`px-3 py-2 text-right text-xs font-semibold ${totalPct === 100 ? "text-emerald-600" : totalPct > 100 ? "text-rose-600" : "text-amber-600"}`}>{toBn(totalPct)}%</td>
              <td className="px-3 py-2 text-right text-xs font-semibold text-slate-800">{fmtTk(totalAmt)}</td>
              <td className="px-3 py-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {(draftPctInvalid || (adding || editingId) ? false : false)}
      {draftPctInvalid && (
        <div className="text-[11px] text-rose-600 mb-2">⚠ শতকরা মান ০-১০০ এর মধ্যে হতে হবে</div>
      )}
      {overLimit && (
        <div className="text-[11px] text-rose-600 mb-2">
          ⚠ প্রজেক্টেড মোট {toBn(projectedTotal)}% — ১০০% ছাড়িয়ে যাচ্ছে
        </div>
      )}
      {!overLimit && totalPct > 100 && (
        <div className="text-[11px] text-rose-600 mb-3">
          ⚠ মোট শতকরা {toBn(totalPct)}% — ১০০% ছাড়িয়ে গেছে, কিছু নিয়ম সমন্বয় করুন।
        </div>
      )}
      {totalPct !== 100 && totalPct <= 100 && (
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