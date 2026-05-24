import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { categoryColor, toBn, fmtTk, monthBounds, pctChange, BN_MONTHS } from "@/lib/finance";
import { useCustomCategories } from "@/hooks/useCustomCategories";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  Wallet, Users, TrendingDown,
  ArrowDown, ArrowUp, PiggyBank, StickyNote, Plus, Pencil, Trash2, Check, X, Target,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TxnDialog, type EditTxn } from "@/components/dashboard/TxnDialog";
import { AiSuggestions } from "@/components/dashboard/AiSuggestions";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";

export const Route = createFileRoute("/_authenticated/app")({ component: Dashboard });

type Txn = { id: string; type: "income" | "expense"; category: string; amount: number; occurred_on: string; note: string | null };
type Debt = { id: string; kind: "receivable" | "payable"; amount: number; settled: boolean };
type Goal = { id: string; label: string; target: number; current: number; color: string };
type Note = { id: string; body: string; created_at: string };
type PlanTask = { id: string; task: string; due_text: string | null; amount_text: string | null; priority: "উচ্চ" | "মাঝারি" | "নিম্ন"; done: boolean };

const BN_DAYS = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];

function Dashboard() {
  const { t, lang } = useLanguage();
  const tr = t;
  const { forType } = useCustomCategories();
  const qc = useQueryClient();
  const [chartRange, setChartRange] = useState<"সাপ্তাহিক" | "মাসিক" | "বার্ষিক">(() => {
    if (typeof window === "undefined") return "সাপ্তাহিক";
    const v = localStorage.getItem("dashboard_chart_range");
    return v === "মাসিক" || v === "বার্ষিক" ? v : "সাপ্তাহিক";
  });
  useEffect(() => {
    localStorage.setItem("dashboard_chart_range", chartRange);
  }, [chartRange]);
  const [txnOpen, setTxnOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<EditTxn | null>(null);
  const [donutView, setDonutView] = useState<"expense" | "income">(() => {
    if (typeof window === "undefined") return "expense";
    const v = localStorage.getItem("dashboard_donut_view");
    return v === "income" ? "income" : "expense";
  });
  useEffect(() => {
    localStorage.setItem("dashboard_donut_view", donutView);
  }, [donutView]);
  const now = new Date();
  const { startISO, endISO, prevStartISO } = useMemo(() => monthBounds(now), []);

  const txnQ = useQuery({
    queryKey: ["transactions", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("id,type,category,amount,occurred_on,note").order("occurred_on", { ascending: false }).limit(1000);
      if (error) throw error;
      return (data ?? []) as Txn[];
    },
  });
  const debtsQ = useQuery({
    queryKey: ["debts", "active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("debts").select("id,kind,amount,settled").eq("settled", false);
      if (error) throw error;
      return (data ?? []) as Debt[];
    },
  });
  const goalsQ = useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("id,label,target,current,color").order("created_at", { ascending: false }).limit(4);
      if (error) throw error;
      return (data ?? []) as Goal[];
    },
  });
  const notesQ = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notes").select("id,body,created_at").order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return (data ?? []) as Note[];
    },
  });
  const tasksQ = useQuery({
    queryKey: ["plan_tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plan_tasks").select("id,task,due_text,amount_text,priority,done").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PlanTask[];
    },
  });
  const budgetsQ = useQuery({
    queryKey: ["budgets", "ai"],
    queryFn: async () => {
      const { data, error } = await supabase.from("budgets").select("category,monthly_limit");
      if (error) throw error;
      return (data ?? []) as { category: string; monthly_limit: number }[];
    },
  });

  const expAllowedSet = useMemo(() => new Set(forType("expense")), [forType]);
  const incAllowedSet = useMemo(() => new Set(forType("income")), [forType]);
  const all = (txnQ.data ?? []).filter((t) =>
    t.type === "expense" ? expAllowedSet.has(t.category) : incAllowedSet.has(t.category),
  );
  const debts = debtsQ.data ?? [];
  const goals = goalsQ.data ?? [];
  const notes = notesQ.data ?? [];
  const tasks = tasksQ.data ?? [];

  const cur = all.filter((t) => t.occurred_on >= startISO && t.occurred_on < endISO);
  const prev = all.filter((t) => t.occurred_on >= prevStartISO && t.occurred_on < startISO);
  const sum = (arr: Txn[], type: "income" | "expense") => arr.filter((t) => t.type === type).reduce((s, t) => s + Number(t.amount), 0);

  const curInc = sum(cur, "income");
  const curExp = sum(cur, "expense");
  const prevInc = sum(prev, "income");
  const prevExp = sum(prev, "expense");
  const curSav = curInc - curExp;
  const prevSav = prevInc - prevExp;
  const receivable = debts.filter((d) => d.kind === "receivable").reduce((s, d) => s + Number(d.amount), 0);
  const payable = debts.filter((d) => d.kind === "payable").reduce((s, d) => s + Number(d.amount), 0);

  const statCards = [
    { label: t("মোট আয়", "Total income"), value: fmtTk(curInc), last: fmtTk(prevInc), pct: pctChange(curInc, prevInc), Icon: Wallet, bg: "bg-emerald-50", fg: "text-emerald-600", val: "text-emerald-600" },
    { label: t("মোট ব্যয়", "Total expense"), value: fmtTk(curExp), last: fmtTk(prevExp), pct: pctChange(curExp, prevExp), Icon: ArrowDown, bg: "bg-rose-50", fg: "text-rose-500", val: "text-rose-500" },
    { label: t("অবশিষ্ট", "Remaining"), value: fmtTk(curSav), last: fmtTk(prevSav), pct: pctChange(curSav, prevSav), Icon: PiggyBank, bg: "bg-blue-50", fg: "text-blue-600", val: "text-blue-600" },
    { label: t("মোট পাওনা", "Total receivable"), value: fmtTk(receivable), last: "—", pct: { value: "", up: true }, Icon: Users, bg: "bg-orange-50", fg: "text-orange-500", val: "text-orange-500" },
    { label: t("মোট দেনা", "Total payable"), value: fmtTk(payable), last: "—", pct: { value: "", up: false }, Icon: TrendingDown, bg: "bg-rose-50", fg: "text-rose-500", val: "text-rose-600" },
  ];

  const expCats = forType("expense");
  const expByCat = new Map<string, number>();
  expCats.forEach((k) => expByCat.set(k, 0));
  cur.filter((t) => t.type === "expense")
    .forEach((t) => { expByCat.set(t.category, (expByCat.get(t.category) ?? 0) + Number(t.amount)); });
  const expenses = Array.from(expByCat.entries())
    .map(([label, amount]) => ({ label, amount, color: categoryColor(label) }))
    .sort((a, b) => b.amount - a.amount);

  const incCats = forType("income");
  const incByCat = new Map<string, number>();
  incCats.forEach((k) => incByCat.set(k, 0));
  cur.filter((t) => t.type === "income")
    .forEach((t) => { incByCat.set(t.category, (incByCat.get(t.category) ?? 0) + Number(t.amount)); });
  const incomes = Array.from(incByCat.entries())
    .map(([label, amount]) => ({ label, amount, color: categoryColor(label) }))
    .sort((a, b) => b.amount - a.amount);

  const buildDonut = (items: { amount: number; color: string }[]) => {
    const total = items.reduce((s, e) => s + e.amount, 0) || 1;
    let acc = 0;
    const segs = items.map((e) => {
      const start = acc; acc += (e.amount / total) * 360;
      return `${e.color} ${start}deg ${acc}deg`;
    }).join(", ") || "#e2e8f0 0deg 360deg";
    return { total, segs };
  };
  const expDonut = buildDonut(expenses);
  const incDonut = buildDonut(incomes);

  const chartSeries = useMemo(() => {
    if (chartRange === "সাপ্তাহিক") {
      const start = new Date(now); start.setDate(start.getDate() - 6);
      const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return { iso: d.toISOString().slice(0, 10), label: BN_DAYS[d.getDay()] }; });
      return days.map(({ iso, label }) => { const day = all.filter((t) => t.occurred_on === iso); return { d: label, inc: sum(day, "income"), exp: sum(day, "expense") }; });
    }
    if (chartRange === "মাসিক") {
      const y = now.getFullYear();
      return BN_MONTHS.map((m, i) => { const mTxns = all.filter((t) => { const d = new Date(t.occurred_on); return d.getFullYear() === y && d.getMonth() === i; }); return { d: m.slice(0, 3), inc: sum(mTxns, "income"), exp: sum(mTxns, "expense") }; });
    }
    const years = Array.from(new Set(all.map((t) => new Date(t.occurred_on).getFullYear()))).sort();
    if (years.length === 0) years.push(now.getFullYear());
    return years.map((y) => { const yt = all.filter((t) => new Date(t.occurred_on).getFullYear() === y); return { d: toBn(y), inc: sum(yt, "income"), exp: sum(yt, "expense") }; });
  }, [all, chartRange]);

  const recent = all.slice(0, 5);

  // Plan tasks (DB)
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const emptyDraft = { task: "", due_text: "", amount_text: "", priority: "মাঝারি" as PlanTask["priority"] };
  const [draft, setDraft] = useState(emptyDraft);
  const priColor = (p: PlanTask["priority"]) => p === "উচ্চ" ? "bg-rose-50 text-rose-600" : p === "মাঝারি" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600";
  const startAdd = () => { setDraft(emptyDraft); setEditingId(null); setAdding(true); };
  const startEdit = (t: PlanTask) => { setDraft({ task: t.task, due_text: t.due_text ?? "", amount_text: t.amount_text ?? "", priority: t.priority }); setEditingId(t.id); setAdding(false); };
  const cancel = () => { setAdding(false); setEditingId(null); setDraft(emptyDraft); };
  const saveTask = async () => {
    if (!draft.task.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = { task: draft.task.trim(), due_text: draft.due_text || null, amount_text: draft.amount_text || null, priority: draft.priority };
    const { error } = editingId
      ? await supabase.from("plan_tasks").update(payload).eq("id", editingId)
      : await supabase.from("plan_tasks").insert({ ...payload, user_id: user.id });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["plan_tasks"] });
    cancel();
  };
  const removeTask = async (id: string) => {
    const { error } = await supabase.from("plan_tasks").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["plan_tasks"] });
  };
  const toggleTask = async (t: PlanTask) => {
    const { error } = await supabase.from("plan_tasks").update({ done: !t.done }).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["plan_tasks"] });
  };

  // Notes
  const [noteInput, setNoteInput] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteInput, setEditNoteInput] = useState("");
  const saveNote = async () => {
    const body = noteInput.trim();
    if (!body) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("notes").insert({ user_id: user.id, body });
    if (error) { toast.error(error.message); return; }
    setNoteInput("");
    qc.invalidateQueries({ queryKey: ["notes"] });
  };
  const startEditNote = (n: Note) => {
    setEditingNoteId(n.id);
    setEditNoteInput(n.body);
  };
  const cancelEditNote = () => {
    setEditingNoteId(null);
    setEditNoteInput("");
  };
  const updateNote = async () => {
    const body = editNoteInput.trim();
    if (!body || !editingNoteId) return;
    const { error } = await supabase.from("notes").update({ body }).eq("id", editingNoteId);
    if (error) { toast.error(error.message); return; }
    setEditingNoteId(null);
    setEditNoteInput("");
    qc.invalidateQueries({ queryKey: ["notes"] });
  };
  const removeNote = async (id: string) => {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["notes"] });
  };

  const renderDraft = () => (
    <div className="p-3 rounded-lg border border-indigo-200 bg-indigo-50/40 space-y-2">
      <input autoFocus value={draft.task} onChange={(e) => setDraft({ ...draft, task: e.target.value })} placeholder={t("কাজের নাম", "Task name")} className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md bg-white" />
      <div className="grid grid-cols-3 gap-2">
        <input value={draft.due_text} onChange={(e) => setDraft({ ...draft, due_text: e.target.value })} placeholder={t("তারিখ", "Date")} className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white" />
        <input value={draft.amount_text} onChange={(e) => setDraft({ ...draft, amount_text: e.target.value })} placeholder={t("৳ পরিমাণ", "৳ Amount")} className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white" />
        <select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as PlanTask["priority"] })} className="px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white">
          <option value="উচ্চ">{t("উচ্চ", "High")}</option><option value="মাঝারি">{t("মাঝারি", "Medium")}</option><option value="নিম্ন">{t("নিম্ন", "Low")}</option>
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={cancel} className="flex items-center gap-1 px-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white"><X className="w-3 h-3" /> {t("বাতিল", "Cancel")}</button>
        <button onClick={saveTask} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md"><Check className="w-3 h-3" /> {t("সেভ", "Save")}</button>
      </div>
    </div>
  );

  return (
    <AppShell title={t("ড্যাশবোর্ড", "Dashboard")}>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-5 border border-slate-200">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-11 h-11 rounded-full ${s.bg} flex items-center justify-center`}><s.Icon className={`w-5 h-5 ${s.fg}`} /></div>
              <div>
                <div className="text-sm text-slate-500">{s.label}</div>
                <div className={`text-xl font-bold ${s.val}`}>{s.value}</div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
              <span className="text-slate-500">{t("গত মাস", "Last month")}: {s.last}</span>
              {s.pct.value && (
                <span className={`flex items-center gap-1 ${s.pct.up ? "text-emerald-600" : "text-rose-500"}`}>
                  {s.pct.up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}{s.pct.value}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {(() => {
          const isExp = donutView === "expense";
          const items = isExp ? expenses : incomes;
          const donut = isExp ? expDonut : incDonut;
          const totalVal = isExp ? curExp : curInc;
          return (
            <div className="bg-white rounded-xl p-5 border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800">{isExp ? t("ব্যয়ের খাতভিত্তিক বিশ্লেষণ", "Expense breakdown by category") : t("আয়ের খাতভিত্তিক বিশ্লেষণ", "Income breakdown by category")}</h3>
                <div className="flex bg-slate-100 rounded-lg p-1 text-xs">
                  <button onClick={() => setDonutView("expense")} className={`px-3 py-1 rounded-md ${isExp ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>{t("ব্যয়", "Expense")}</button>
                  <button onClick={() => setDonutView("income")} className={`px-3 py-1 rounded-md ${!isExp ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>{t("আয়", "Income")}</button>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="relative w-44 h-44 flex-shrink-0">
                  <div className="w-full h-full rounded-full" style={{ background: `conic-gradient(${donut.segs})` }}></div>
                  <div className="absolute inset-6 bg-white rounded-full flex flex-col items-center justify-center">
                    <div className="text-xs text-slate-500">{isExp ? t("মোট ব্যয়", "Total expense") : t("মোট আয়", "Total income")}</div>
                    <div className="font-bold text-slate-800">{fmtTk(totalVal)}</div>
                  </div>
                </div>
                <div className="flex-1 space-y-2.5 max-h-44 overflow-y-auto pr-1">
                  {items.length === 0 && <div className="text-sm text-slate-400">{t("কোনো ক্যাটাগরি নেই", "No categories")}</div>}
                  {items.map((e) => (
                    <div key={e.label} className="flex items-center text-sm">
                      <span className="w-2.5 h-2.5 rounded-full mr-2 flex-shrink-0" style={{ background: e.color }}></span>
                      <span className="flex-1 text-slate-700 truncate">{e.label}</span>
                      <span className="w-20 text-right font-medium text-slate-800">{fmtTk(e.amount)}</span>
                      <span className="w-14 text-right text-slate-500">{toBn(((e.amount / donut.total) * 100).toFixed(1))}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">{t("আয় / ব্যয় চার্ট", "Income / Expense chart")}</h3>
            <div className="flex bg-slate-100 rounded-lg p-1 text-xs">
              {(["সাপ্তাহিক", "মাসিক", "বার্ষিক"] as const).map((r) => {
                const lbl = r === "সাপ্তাহিক" ? t("সাপ্তাহিক", "Weekly") : r === "মাসিক" ? t("মাসিক", "Monthly") : t("বার্ষিক", "Yearly");
                return (
                <button
                  key={r}
                  onClick={() => setChartRange(r)}
                  className={`px-3 py-1 rounded-md transition ${chartRange === r ? "bg-white shadow text-slate-800 font-medium" : "text-slate-500 hover:text-slate-700"}`}
                >
                  {lbl}
                </button>
                );
              })}
            </div>
          </div>
          <div className="h-56 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.4} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f43f5e" stopOpacity={0.4} /><stop offset="100%" stopColor="#f43f5e" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="d" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} formatter={(v: number, name: string) => [`৳ ${v.toLocaleString()}`, name === "inc" ? (lang === "bn" ? "আয়" : "Income") : (lang === "bn" ? "ব্যয়" : "Expense")]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={(v) => (v === "inc" ? (lang === "bn" ? "আয়" : "Income") : (lang === "bn" ? "ব্যয়" : "Expense"))} />
                <Area type="monotone" dataKey="inc" stroke="#10b981" strokeWidth={2} fill="url(#incGrad)" />
                <Area type="monotone" dataKey="exp" stroke="#f43f5e" strokeWidth={2} fill="url(#expGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent + Plan */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">{t("সাম্প্রতিক লেনদেন", "Recent transactions")}</h3>
            <div className="flex items-center gap-2">
              <Link to="/transactions" className="text-sm text-indigo-600 hover:underline">{t("সব দেখুন", "View all")}</Link>
              <button onClick={() => { setEditingTxn(null); setTxnOpen(true); }} className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                <Plus className="w-3 h-3" /> {t("নতুন", "New")}
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {txnQ.isLoading && <div className="text-sm text-slate-400 py-4">{t("লোড হচ্ছে...", "Loading...")}</div>}
            {!txnQ.isLoading && recent.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">{t("কোনো লেনদেন নেই", "No transactions")}</div>}
            {recent.map((t) => {
              const income = t.type === "income";
              return (
                <div
                  key={t.id}
                  onClick={() => { setEditingTxn({ id: t.id, type: t.type, category: t.category, amount: Number(t.amount), occurred_on: t.occurred_on, note: t.note }); setTxnOpen(true); }}
                  className="flex items-center gap-2 py-1 cursor-pointer hover:bg-slate-50 rounded-md px-1 -mx-1"
                  title="Click to edit"
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${income ? "bg-emerald-50" : "bg-rose-50"}`}>
                    {income ? <ArrowUp className="w-4 h-4 text-emerald-600" /> : <ArrowDown className="w-4 h-4 text-rose-500" />}
                  </div>
                  <span className="font-medium text-slate-800 flex-1 text-sm truncate">{t.note || t.category}</span>
                  <span className="text-xs text-slate-500">{toBn(t.occurred_on)}</span>
                  <span className={`font-bold text-sm w-24 text-right ${income ? "text-emerald-600" : "text-rose-500"}`}>{fmtTk(Number(t.amount))}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">{t("আগামী বাজেট ও পরিকল্পনা", "Upcoming budget & plans")}</h3>
            <button onClick={startAdd} className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
              <Plus className="w-3 h-3" /> {t("নতুন", "New")}
            </button>
          </div>
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {adding && renderDraft()}
            {tasks.map((t) => editingId === t.id ? (
              <div key={t.id}>{renderDraft()}</div>
            ) : (
              <div key={t.id} className="group flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50">
                <input type="checkbox" checked={t.done} onChange={() => toggleTask(t)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 flex-shrink-0 cursor-pointer" />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${t.done ? "text-slate-400 line-through" : "text-slate-800"}`}>{t.task}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{t.due_text || "—"} · {t.amount_text || ""}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${priColor(t.priority)}`}>{t.priority === "উচ্চ" ? tr("উচ্চ", "High") : t.priority === "মাঝারি" ? tr("মাঝারি", "Medium") : tr("নিম্ন", "Low")}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => startEdit(t)} className="p-1.5 rounded-md hover:bg-indigo-50 text-slate-500 hover:text-indigo-600"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => removeTask(t.id)} className="p-1.5 rounded-md hover:bg-rose-50 text-slate-500 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
            {tasks.length === 0 && !adding && <div className="text-center text-sm text-slate-400 py-6">{t("কোনো পরিকল্পনা নেই", "No plans")}</div>}
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">{t("সঞ্চয় লক্ষ্য", "Savings goals")}</h3>
            <Link to="/goals" className="text-sm text-indigo-600">{t("সব দেখুন →", "View all →")}</Link>
          </div>
          <div className="space-y-4">
            {goals.length === 0 && <div className="text-sm text-slate-400 text-center py-4">{t("কোনো লক্ষ্য নেই", "No goals")}</div>}
            {goals.map((g) => {
              const pct = g.target > 0 ? Math.min(100, (Number(g.current) / Number(g.target)) * 100) : 0;
              return (
                <div key={g.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center"><Target className="w-4 h-4 text-indigo-600" /></div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-slate-700">{g.label}</span>
                      <span className="text-slate-500">{fmtTk(Number(g.current))} / {fmtTk(Number(g.target))}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-600 w-10 text-right">{toBn(pct.toFixed(0))}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">{t("পাওনা / দেনা সারাংশ", "Receivable / Payable summary")}</h3>
            <Link to="/debts" className="text-sm text-indigo-600">{t("বিস্তারিত →", "Details →")}</Link>
          </div>
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-emerald-50/60 border border-emerald-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center"><Users className="w-5 h-5 text-emerald-600" /></div>
              <div><div className="text-xs text-slate-600">{t("মোট পাওনা", "Total receivable")}</div><div className="font-bold text-emerald-700">{fmtTk(receivable)}</div></div>
            </div>
            <div className="p-4 rounded-lg bg-rose-50/60 border border-rose-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center"><Users className="w-5 h-5 text-rose-500" /></div>
              <div><div className="text-xs text-slate-600">{t("মোট দেনা", "Total payable")}</div><div className="font-bold text-rose-600">{fmtTk(payable)}</div></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex items-center gap-2 mb-4"><StickyNote className="w-5 h-5 text-amber-500" /><h3 className="font-bold text-slate-800">{t("দ্রুত নোট", "Quick notes")}</h3></div>
          <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
            {notes.length === 0 && <div className="text-xs text-slate-400 text-center py-3">{t("কোনো নোট নেই", "No notes")}</div>}
            {notes.map((n) => (
              <div key={n.id} className="group flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg p-2 text-xs text-slate-700">
                <span className="flex-1">{n.body}</span>
                <button onClick={() => removeNote(n.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={noteInput} onChange={(e) => setNoteInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveNote()} className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder={t("নোট লিখুন...", "Write a note...")} />
            <button onClick={saveNote} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600">{t("সেভ", "Save")}</button>
          </div>
        </div>
      </div>

      {/* AI Suggestions — bottom */}
      <AiSuggestions
        curIncome={curInc}
        curExpense={curExp}
        prevIncome={prevInc}
        prevExpense={prevExp}
        receivable={receivable}
        payable={payable}
        expenseByCategory={expenses.filter((e) => e.amount > 0).map((e) => ({ category: e.label, amount: e.amount }))}
        incomeByCategory={incomes.filter((e) => e.amount > 0).map((e) => ({ category: e.label, amount: e.amount }))}
        goals={goals.map((g) => ({ label: g.label, target: Number(g.target), current: Number(g.current) }))}
        budgets={(budgetsQ.data ?? []).map((b) => {
          const spent = expenses.find((e) => e.label === b.category)?.amount ?? 0;
          return { category: b.category, limit: Number(b.monthly_limit), spent };
        })}
        monthLabel={`${BN_MONTHS[now.getMonth()]} ${toBn(now.getFullYear())}`}
      />

      <div className="text-center text-xs text-slate-500 mt-6">© {toBn(now.getFullYear())} {t("আমার হিসাব", "My Finance")} <span className="text-rose-500">♥</span></div>

      <TxnDialog open={txnOpen} onOpenChange={(v) => { setTxnOpen(v); if (!v) setEditingTxn(null); }} editTxn={editingTxn} />
    </AppShell>
  );
}