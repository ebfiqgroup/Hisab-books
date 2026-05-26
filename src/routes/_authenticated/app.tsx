import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { categoryColor, toBn, fmtTk, monthBounds, pctChange, BN_MONTHS } from "@/lib/finance";
import { useCustomCategories } from "@/hooks/useCustomCategories";
import { useIsAdmin } from "@/hooks/useRole";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  Wallet, Users, TrendingDown, Search,
  ArrowDown, ArrowUp, PiggyBank, StickyNote, Plus, Pencil, Trash2, Check, X, Target,
  ShieldCheck, Sparkles, BarChart3, Receipt, ListChecks, Flame, Calendar, Zap, Trophy, AlertTriangle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TxnDialog, type EditTxn } from "@/components/dashboard/TxnDialog";
import { AiSuggestions } from "@/components/dashboard/AiSuggestions";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";

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
  const uid = useCurrentUserId();
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
    queryKey: ["transactions", "all", uid],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("id,type,category,amount,occurred_on,note").eq("user_id", uid).order("occurred_on", { ascending: false }).limit(1000);
      if (error) throw error;
      return (data ?? []) as Txn[];
    },
  });
  const debtsQ = useQuery({
    queryKey: ["debts", "active", uid],
    queryFn: async () => {
      const { data, error } = await supabase.from("debts").select("id,kind,amount,settled").eq("user_id", uid).eq("settled", false);
      if (error) throw error;
      return (data ?? []) as Debt[];
    },
  });
  const goalsQ = useQuery({
    queryKey: ["goals", uid],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("id,label,target,current,color").eq("user_id", uid).order("created_at", { ascending: false }).limit(4);
      if (error) throw error;
      return (data ?? []) as Goal[];
    },
  });
  const notesQ = useQuery({
    queryKey: ["notes", uid],
    queryFn: async () => {
      const { data, error } = await supabase.from("notes").select("id,body,created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return (data ?? []) as Note[];
    },
  });
  const tasksQ = useQuery({
    queryKey: ["plan_tasks", uid],
    queryFn: async () => {
      const { data, error } = await supabase.from("plan_tasks").select("id,task,due_text,amount_text,priority,done").eq("user_id", uid).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PlanTask[];
    },
  });
  const budgetsQ = useQuery({
    queryKey: ["budgets", "ai", uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budgets")
        .select("id,category,monthly_limit,label,start_at,end_at,status")
        .eq("user_id", uid)
        .order("start_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as {
        id: string; category: string; monthly_limit: number;
        label: string | null; start_at: string; end_at: string;
        status: "pending" | "ongoing" | "completed" | null;
      }[];
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
    { label: t("মোট আয়", "Total income"), value: fmtTk(curInc), last: fmtTk(prevInc), pct: pctChange(curInc, prevInc), Icon: Wallet, grad: "from-emerald-500 to-teal-500", ring: "ring-emerald-100", val: "text-emerald-600" },
    { label: t("মোট ব্যয়", "Total expense"), value: fmtTk(curExp), last: fmtTk(prevExp), pct: pctChange(curExp, prevExp), Icon: ArrowDown, grad: "from-rose-500 to-pink-500", ring: "ring-rose-100", val: "text-rose-500" },
    { label: t("অবশিষ্ট", "Remaining"), value: fmtTk(curSav), last: fmtTk(prevSav), pct: pctChange(curSav, prevSav), Icon: PiggyBank, grad: "from-blue-500 to-indigo-500", ring: "ring-blue-100", val: "text-blue-600" },
    { label: t("মোট পাওনা", "Total receivable"), value: fmtTk(receivable), last: "—", pct: { value: "", up: true }, Icon: Users, grad: "from-amber-500 to-orange-500", ring: "ring-orange-100", val: "text-orange-500" },
    { label: t("মোট দেনা", "Total payable"), value: fmtTk(payable), last: "—", pct: { value: "", up: false }, Icon: TrendingDown, grad: "from-fuchsia-500 to-rose-500", ring: "ring-rose-100", val: "text-rose-600" },
  ];

  // 7-day sparkline series per card type
  const spark7 = useMemo(() => {
    const start = new Date(now); start.setDate(start.getDate() - 6);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
    const inc = days.map((iso) => all.filter((t) => t.occurred_on === iso && t.type === "income").reduce((s, t) => s + Number(t.amount), 0));
    const exp = days.map((iso) => all.filter((t) => t.occurred_on === iso && t.type === "expense").reduce((s, t) => s + Number(t.amount), 0));
    const rem = inc.map((v, i) => v - exp[i]);
    return { inc, exp, rem };
  }, [all]);
  const sparkData: Record<string, number[] | null> = {
    [t("মোট আয়", "Total income")]: spark7.inc,
    [t("মোট ব্যয়", "Total expense")]: spark7.exp,
    [t("অবশিষ্ট", "Remaining")]: spark7.rem,
    [t("মোট পাওনা", "Total receivable")]: null,
    [t("মোট দেনা", "Total payable")]: null,
  };
  const sparkColor: Record<string, string> = {
    [t("মোট আয়", "Total income")]: "#10b981",
    [t("মোট ব্যয়", "Total expense")]: "#f43f5e",
    [t("অবশিষ্ট", "Remaining")]: "#3b82f6",
    [t("মোট পাওনা", "Total receivable")]: "#f59e0b",
    [t("মোট দেনা", "Total payable")]: "#e11d48",
  };

  const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
    const w = 80, h = 20;
    const min = Math.min(...data, 0), max = Math.max(...data, 1);
    const range = max - min || 1;
    const step = w / (data.length - 1 || 1);
    const pts = data.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`).join(" ");
    const area = `0,${h} ${pts} ${w},${h}`;
    const gid = `sg-${color.replace("#", "")}`;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-5">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#${gid})`} />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    );
  };

  // Helpers for budget time-progress
  const daysBetween = (a: string, b: string) => Math.max(0, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
  const todayIso = now.toISOString().slice(0, 10);

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

  // Budget rows (with computed spent for each budget's own date range)
  const nowIsoFull = now.toISOString();
  const budgetRows = useMemo(() => {
    const list = budgetsQ.data ?? [];
    return list.map((b) => {
      const sIso = b.start_at.slice(0, 10);
      const eIso = b.end_at.slice(0, 10);
      const spent = all
        .filter((t) => t.type === "expense" && t.category === b.category && t.occurred_on >= sIso && t.occurred_on <= eIso)
        .reduce((s, t) => s + Number(t.amount), 0);
      const auto: "pending" | "ongoing" | "completed" =
        nowIsoFull < b.start_at ? "pending" : nowIsoFull > b.end_at ? "completed" : "ongoing";
      const status = b.status ?? auto;
      return { ...b, spent, status };
    });
  }, [budgetsQ.data, all, nowIsoFull]);
  const activeBudgets = useMemo(
    () => budgetRows.filter((b) => b.status !== "completed").slice(0, 4),
    [budgetRows],
  );
  const totalBudgetLimit = activeBudgets.reduce((s, b) => s + Number(b.monthly_limit), 0);
  const totalBudgetSpent = activeBudgets.reduce((s, b) => s + b.spent, 0);

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
      ? await supabase.from("plan_tasks").update(payload).eq("id", editingId).eq("user_id", uid)
      : await supabase.from("plan_tasks").insert({ ...payload, user_id: user.id });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["plan_tasks"] });
    cancel();
  };
  const removeTask = async (id: string) => {
    const { error } = await supabase.from("plan_tasks").delete().eq("id", id).eq("user_id", uid);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["plan_tasks"] });
  };
  const toggleTask = async (t: PlanTask) => {
    const { error } = await supabase.from("plan_tasks").update({ done: !t.done }).eq("id", t.id).eq("user_id", uid);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["plan_tasks"] });
  };

  // Notes
  const [noteInput, setNoteInput] = useState("");
  const [noteSearch, setNoteSearch] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteInput, setEditNoteInput] = useState("");
  const filteredNotes = useMemo(() => {
    const q = noteSearch.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => n.body.toLowerCase().includes(q));
  }, [notes, noteSearch]);
  const saveNote = async () => {
    const body = noteInput.trim();
    if (!body) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const exists = notes.some((n) => n.body.trim() === body);
    if (exists) {
      toast.warning(t("এই নোট ইতিমধ্যে আছে।", "This note already exists."));
      return;
    }
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
    const { error } = await supabase.from("notes").update({ body }).eq("id", editingNoteId).eq("user_id", uid);
    if (error) { toast.error(error.message); return; }
    setEditingNoteId(null);
    setEditNoteInput("");
    qc.invalidateQueries({ queryKey: ["notes"] });
  };
  const removeNote = async (id: string) => {
    const { error } = await supabase.from("notes").delete().eq("id", id).eq("user_id", uid);
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

  const isAdmin = useIsAdmin();

  return (
    <AppShell title={t("ড্যাশবোর্ড", "Dashboard")}>
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl mb-5 p-5 sm:p-7 text-white shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600" />
        <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-56 h-56 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/80">
              <Sparkles className="w-3.5 h-3.5" />
              {`${BN_MONTHS[now.getMonth()]} ${toBn(now.getFullYear())}`}
            </div>
            <h2 className="mt-2 text-xl sm:text-2xl font-bold">{t("স্বাগতম! আপনার আর্থিক সারাংশ", "Welcome back! Your financial overview")}</h2>
            <p className="mt-1 text-sm text-white/80">{t("এক নজরে আয়, ব্যয়, সঞ্চয় ও পরিকল্পনা।", "Income, expenses, savings & plans at a glance.")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="px-3 py-2 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20">
              <div className="text-[10px] uppercase tracking-wider text-white/70">{t("এই মাসের অবশিষ্ট", "This month net")}</div>
              <div className="text-lg font-bold">{fmtTk(curSav)}</div>
            </div>
            <button onClick={() => { setEditingTxn(null); setTxnOpen(true); }} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-indigo-700 text-sm font-semibold shadow hover:shadow-md hover:scale-[1.02] transition">
              <Plus className="w-4 h-4" /> {t("নতুন লেনদেন", "New transaction")}
            </button>
          </div>
        </div>
      </div>

      {/* Admin Panel Link (only for admins) */}
      {isAdmin && (
        <div className="mb-5">
          <Link
            to="/admin"
            className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-white hover:shadow-md transition"
            style={{ borderColor: "var(--brand-line)" }}
          >
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm text-slate-800">{t("অ্যাডমিন প্যানেল", "Admin Panel")}</div>
              <div className="text-xs text-slate-500">{t("ব্যবহারকারী, রোল ও সিস্টেম ম্যানেজমেন্ট", "User, role & system management")}</div>
            </div>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">{t("ওপেন করুন", "Open")} →</span>
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        {statCards.map((s) => (
          <div key={s.label} className={`group relative bg-card text-card-foreground rounded-xl p-3.5 border border-border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden`}>
            {/* top accent bar */}
            <div className={`absolute top-0 inset-x-0 h-[2.5px] bg-gradient-to-r ${s.grad} rounded-t-xl`} />
            {/* glow blob */}
            <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full bg-gradient-to-br ${s.grad} opacity-[0.08] group-hover:opacity-[0.18] blur-xl transition-opacity duration-500 dark:opacity-[0.18] dark:group-hover:opacity-[0.28]`} />

            <div className="relative flex items-start justify-between gap-2 mb-2.5">
              <div className={`relative w-9 h-9 rounded-lg bg-gradient-to-br ${s.grad} flex items-center justify-center shadow-md shadow-black/10 dark:shadow-black/40 group-hover:scale-105 group-hover:rotate-2 transition-transform duration-300`}>
                <s.Icon className="w-4 h-4 text-white drop-shadow" />
              </div>
              {s.pct.value && (
                <span className={`flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${s.pct.up ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 ring-1 ring-emerald-100 dark:ring-emerald-400/20" : "text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 ring-1 ring-rose-100 dark:ring-rose-400/20"}`}>
                  {s.pct.up ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}{s.pct.value}
                </span>
              )}
            </div>
            <div className="relative">
              <div className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-0.5">{s.label}</div>
              <div className={`text-lg font-bold tracking-tight ${s.val} leading-tight`}>{s.value}</div>
            </div>
            {sparkData[s.label] && (
              <div className="relative mt-1.5 -mx-1 opacity-70 group-hover:opacity-100 transition">
                <Sparkline data={sparkData[s.label]!} color={sparkColor[s.label]} />
              </div>
            )}
            <div className="relative mt-2 pt-2 border-t border-dashed border-border text-[10px] text-muted-foreground">
              {t("গত মাস", "Last month")}: <span className="font-medium text-foreground/70">{s.last}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {(() => {
          const isExp = donutView === "expense";
          const items = isExp ? expenses : incomes;
          const donut = isExp ? expDonut : incDonut;
          const totalVal = isExp ? curExp : curInc;
          return (
            <div className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between mb-4 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-sm shrink-0">
                    <BarChart3 className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-bold text-slate-800 truncate">{isExp ? t("ব্যয়ের খাতভিত্তিক বিশ্লেষণ", "Expense breakdown") : t("আয়ের খাতভিত্তিক বিশ্লেষণ", "Income breakdown")}</h3>
                </div>
                <div className="flex bg-slate-100 rounded-lg p-1 text-xs">
                  <button onClick={() => setDonutView("expense")} className={`px-3 py-1 rounded-md ${isExp ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>{t("ব্যয়", "Expense")}</button>
                  <button onClick={() => setDonutView("income")} className={`px-3 py-1 rounded-md ${!isExp ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>{t("আয়", "Income")}</button>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                <div className="relative w-44 h-44 flex-shrink-0">
                  <div className="w-full h-full rounded-full" style={{ background: `conic-gradient(${donut.segs})` }}></div>
                  <div className="absolute inset-6 bg-white rounded-full flex flex-col items-center justify-center">
                    <div className="text-xs text-slate-500">{isExp ? t("মোট ব্যয়", "Total expense") : t("মোট আয়", "Total income")}</div>
                    <div className="font-bold text-slate-800">{fmtTk(totalVal)}</div>
                  </div>
                </div>
                <div className="w-full flex-1 space-y-2.5 max-h-44 overflow-y-auto pr-1">
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

        <div className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm shrink-0">
                <TrendingDown className="w-4 h-4 text-white rotate-180" />
              </div>
              <h3 className="font-bold text-slate-800 truncate">{t("আয় / ব্যয় চার্ট", "Income / Expense")}</h3>
            </div>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-sm shrink-0">
                <Receipt className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-bold text-slate-800 truncate">{t("সাম্প্রতিক লেনদেন", "Recent transactions")}</h3>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/transactions" className="text-sm text-indigo-600 hover:underline">{t("সব দেখুন", "View all")}</Link>
              <button onClick={() => { setEditingTxn(null); setTxnOpen(true); }} className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-md hover:shadow-md transition">
                <Plus className="w-3 h-3" /> {t("নতুন", "New")}
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {txnQ.isLoading && <div className="text-sm text-slate-400 py-4">{t("লোড হচ্ছে...", "Loading...")}</div>}
            {!txnQ.isLoading && recent.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">{t("কোনো লেনদেন নেই", "No transactions")}</div>}
            {recent.map((t) => {
              const income = t.type === "income";
              const catColor = categoryColor(t.category);
              return (
                <div
                  key={t.id}
                  onClick={() => { setEditingTxn({ id: t.id, type: t.type, category: t.category, amount: Number(t.amount), occurred_on: t.occurred_on, note: t.note }); setTxnOpen(true); }}
                  className="group/t flex items-center gap-2.5 py-2 px-2 -mx-2 cursor-pointer rounded-lg hover:bg-gradient-to-r hover:from-slate-50 hover:to-transparent transition"
                  title="Click to edit"
                >
                  <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${income ? "bg-gradient-to-br from-emerald-400 to-teal-500" : "bg-gradient-to-br from-rose-400 to-pink-500"} group-hover/t:scale-110 group-hover/t:rotate-3 transition`}>
                    {income ? <ArrowUp className="w-4 h-4 text-white" /> : <ArrowDown className="w-4 h-4 text-white" />}
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white" style={{ background: catColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 text-sm truncate">{t.note || t.category}</div>
                    <div className="text-[10px] text-slate-500 truncate">{t.category} · {toBn(t.occurred_on)}</div>
                  </div>
                  <span className={`font-extrabold text-sm tracking-tight w-24 text-right ${income ? "text-emerald-600" : "text-rose-500"}`}>
                    {income ? "+" : "−"}{fmtTk(Number(t.amount))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm shrink-0">
                <ListChecks className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-bold text-slate-800 truncate">{t("বাজেট ও পরিকল্পনা", "Budget & Plans")}</h3>
              {activeBudgets.length > 0 && (
                <span className="text-xs text-slate-500 shrink-0">
                  {fmtTk(totalBudgetSpent)} / {fmtTk(totalBudgetLimit)}
                </span>
              )}
            </div>
            <Link to="/budget" className="text-sm text-indigo-600 shrink-0">{t("সব দেখুন →", "View all →")}</Link>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {activeBudgets.length === 0 ? (
              <div className="text-sm text-slate-400 text-center py-6">
                {t("কোনো চলমান বাজেট নেই", "No active budgets")} ·{" "}
                <Link to="/budget" className="text-indigo-600">{t("নতুন তৈরি করুন", "Create one")}</Link>
              </div>
            ) : (
              activeBudgets.map((b) => {
                const pct = b.monthly_limit > 0 ? Math.min(100, (b.spent / b.monthly_limit) * 100) : 0;
                const over = b.monthly_limit > 0 && b.spent > b.monthly_limit;
                const color = categoryColor(b.category);
                const daysLeft = daysBetween(todayIso, b.end_at.slice(0, 10));
                const warn = !over && pct >= 80;
                return (
                  <Link key={b.id} to="/budget" className="group/b block p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm hover:bg-gradient-to-br hover:from-slate-50/60 hover:to-white transition">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white shadow" style={{ background: color }} />
                        <span className="text-sm font-medium text-slate-800 truncate">{b.label || b.category}</span>
                        {over ? (
                          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200 shrink-0">
                            <AlertTriangle className="w-2.5 h-2.5" /> {t("অতিরিক্ত", "Over")}
                          </span>
                        ) : warn ? (
                          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-200 shrink-0">
                            <Flame className="w-2.5 h-2.5" /> {t("সতর্ক", "Warn")}
                          </span>
                        ) : (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${b.status === "ongoing" ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200" : "bg-amber-50 text-amber-600 ring-1 ring-amber-200"}`}>
                            {b.status === "ongoing" ? t("চলমান", "Ongoing") : t("অপেক্ষিত", "Pending")}
                          </span>
                        )}
                      </div>
                      <span className={`text-xs font-semibold shrink-0 ${over ? "text-rose-500" : "text-slate-600"}`}>{toBn(pct.toFixed(0))}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden relative">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${pct}%`,
                          background: over
                            ? "linear-gradient(90deg,#fb7185,#e11d48)"
                            : `linear-gradient(90deg, ${color}99, ${color})`,
                          boxShadow: over ? "0 0 12px rgba(244,63,94,0.45)" : `0 0 8px ${color}55`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-xs">
                      <span className={over ? "text-rose-500 font-medium" : "text-slate-600 font-medium"}>{fmtTk(b.spent)} <span className="text-slate-400 font-normal">/ {fmtTk(b.monthly_limit)}</span></span>
                      <span className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Calendar className="w-3 h-3" />
                        {b.status === "ongoing" ? `${toBn(daysLeft)} ${t("দিন বাকি", "days left")}` : t("শুরু হয়নি", "Not started")}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-sm shrink-0">
                <Target className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-bold text-slate-800 truncate">{t("সঞ্চয় লক্ষ্য", "Savings goals")}</h3>
            </div>
            <Link to="/goals" className="text-sm text-indigo-600">{t("সব দেখুন →", "View all →")}</Link>
          </div>
          <div className="space-y-3">
            {goals.length === 0 && <div className="text-sm text-slate-400 text-center py-4">{t("কোনো লক্ষ্য নেই", "No goals")}</div>}
            {goals.map((g) => {
              const pct = g.target > 0 ? Math.min(100, (Number(g.current) / Number(g.target)) * 100) : 0;
              const done = pct >= 100;
              const accent = g.color || "#6366f1";
              return (
                <div key={g.id} className="group/g flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-slate-50/70 transition">
                  <div
                    className="relative w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: `conic-gradient(${accent} ${pct * 3.6}deg, #e2e8f0 0deg)` }}
                  >
                    <div className="absolute inset-1 rounded-full bg-white flex items-center justify-center">
                      {done ? <Trophy className="w-4 h-4 text-amber-500" /> : <Target className="w-4 h-4" style={{ color: accent }} />}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                      <span className="font-medium text-slate-800 truncate flex items-center gap-1.5">
                        {g.label}
                        {done && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-200 shrink-0">{t("অর্জিত", "Achieved")}</span>}
                      </span>
                      <span className="text-slate-500 shrink-0 text-[11px]">{fmtTk(Number(g.current))} / {fmtTk(Number(g.target))}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${accent}aa, ${accent})`,
                          boxShadow: `0 0 8px ${accent}66`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-bold w-10 text-right" style={{ color: done ? "#d97706" : accent }}>{toBn(pct.toFixed(0))}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-rose-500 flex items-center justify-center shadow-sm shrink-0">
                <Users className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-bold text-slate-800 truncate">{t("দেনা / পাওনা সারাংশ", "Receivable / Payable")}</h3>
            </div>
            <Link to="/debts" className="text-sm text-indigo-600">{t("বিস্তারিত →", "Details →")}</Link>
          </div>
          <div className="space-y-3">
            {(() => {
              const net = receivable - payable;
              const total = receivable + payable || 1;
              const recPct = (receivable / total) * 100;
              return (
                <>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50/40 border border-emerald-100 flex items-center gap-3 hover:shadow-md hover:-translate-y-0.5 transition group/r">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow-md flex items-center justify-center group-hover/r:scale-110 transition">
                      <ArrowUp className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{t("মোট পাওনা", "Total receivable")}</div>
                      <div className="font-extrabold text-emerald-700 text-lg leading-tight">{fmtTk(receivable)}</div>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-rose-50 to-pink-50/40 border border-rose-100 flex items-center gap-3 hover:shadow-md hover:-translate-y-0.5 transition group/p">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 shadow-md flex items-center justify-center group-hover/p:scale-110 transition">
                      <ArrowDown className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{t("মোট দেনা", "Total payable")}</div>
                      <div className="font-extrabold text-rose-600 text-lg leading-tight">{fmtTk(payable)}</div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-dashed border-slate-200">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                      <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{t("নেট ব্যালেন্স", "Net balance")}</span>
                      <span className={`font-bold ${net >= 0 ? "text-emerald-600" : "text-rose-500"}`}>{fmtTk(net)}</span>
                    </div>
                    <div className="h-1.5 bg-rose-100 rounded-full overflow-hidden flex">
                      <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700" style={{ width: `${recPct}%` }} />
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-sm hover:shadow-md transition">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shadow-sm shrink-0">
              <StickyNote className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-slate-800">{t("দ্রুত নোট", "Quick notes")}</h3>
          </div>
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={noteSearch}
              onChange={(e) => setNoteSearch(e.target.value)}
              placeholder={t("নোট খুঁজুন...", "Search notes...")}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-300"
            />
          </div>
          <div className="space-y-3 mb-4 max-h-40 overflow-y-auto">
            {filteredNotes.length === 0 && <div className="text-xs text-slate-400 text-center py-3">{noteSearch ? t("কোনো নোট পাওয়া যায়নি", "No notes found") : t("কোনো নোট নেই", "No notes")}</div>}
            {filteredNotes.map((n) => (
              editingNoteId === n.id ? (
                <div key={n.id} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  <input
                    autoFocus
                    value={editNoteInput}
                    onChange={(e) => setEditNoteInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && updateNote()}
                    className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded-md bg-white"
                  />
                  <button onClick={updateNote} className="p-1 rounded-md hover:bg-emerald-50 text-emerald-600"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={cancelEditNote} className="p-1 rounded-md hover:bg-rose-50 text-rose-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <div key={n.id} className="group relative bg-gradient-to-br from-amber-50 to-yellow-50/60 border border-amber-100 rounded-lg p-2.5 text-xs text-slate-700 hover:shadow-sm hover:border-amber-200 transition">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 w-1 self-stretch rounded-full bg-gradient-to-b from-amber-400 to-orange-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-800 leading-relaxed break-words">{n.body}</div>
                      <div className="text-[9px] text-amber-700/70 mt-1 uppercase tracking-wider">{toBn(n.created_at.slice(0, 10))}</div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                      <button onClick={() => startEditNote(n)} className="p-1 rounded-md hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => removeNote(n.id)} className="p-1 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              )
            ))}
          </div>
          <div className="relative">
            <div className="flex gap-2">
              <input
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveNote()}
                maxLength={280}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 transition"
                placeholder={t("নোট লিখুন...", "Write a note...")}
              />
              <button
                onClick={saveNote}
                disabled={!noteInput.trim()}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-sm font-semibold shadow hover:shadow-md hover:scale-[1.03] disabled:opacity-40 disabled:hover:scale-100 transition"
              >
                {t("সেভ", "Save")}
              </button>
            </div>
            {noteInput.length > 0 && (
              <div className={`mt-1 text-[10px] text-right ${noteInput.length > 250 ? "text-rose-500" : "text-slate-400"}`}>
                {toBn(noteInput.length)} / {toBn(280)}
              </div>
            )}
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