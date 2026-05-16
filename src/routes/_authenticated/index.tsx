import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, categoryColor, toBn, fmtTk, monthBounds, pctChange, BN_MONTHS } from "@/lib/finance";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  Wallet, Calendar, Download, Bell, ChevronDown, Users, TrendingDown,
  ArrowDown, ArrowUp, PiggyBank, BookOpen, House, StickyNote, Plus, Pencil, Trash2, Check, X
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";

export const Route = createFileRoute("/_authenticated/")({ component: Dashboard });

const goals = [
  { Icon: PiggyBank, label: "সঞ্চয় লক্ষ্য", current: "৳ ২৬,৭০০", target: "৳ ৩০,০০০", pct: 89, color: "bg-emerald-500", iconBg: "bg-rose-100", iconFg: "text-rose-500" },
  { Icon: BookOpen, label: "জরুরি তহবিল", current: "৳ ১২,০০০", target: "৳ ২০,০০০", pct: 60, color: "bg-blue-500", iconBg: "bg-blue-100", iconFg: "text-blue-600" },
  { Icon: House, label: "ভবিষ্যৎ ফান্ড", current: "৳ ৮,০০০", target: "৳ ১৫,০০০", pct: 53, color: "bg-orange-500", iconBg: "bg-orange-100", iconFg: "text-orange-500" },
];

type Txn = { id: string; type: "income" | "expense"; category: string; amount: number; occurred_on: string; note: string | null };
type Debt = { id: string; kind: "receivable" | "payable"; amount: number; settled: boolean };

const BN_DAYS = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];

function Dashboard() {
  const [chartRange, setChartRange] = useState<"সাপ্তাহিক" | "মাসিক" | "বার্ষিক">("সাপ্তাহিক");
  const now = new Date();
  const { startISO, endISO, prevStartISO } = useMemo(() => monthBounds(now), []);

  const txnQ = useQuery({
    queryKey: ["transactions", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id,type,category,amount,occurred_on,note")
        .order("occurred_on", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Txn[];
    },
  });

  const debtsQ = useQuery({
    queryKey: ["debts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debts")
        .select("id,kind,amount,settled")
        .eq("settled", false);
      if (error) throw error;
      return (data ?? []) as Debt[];
    },
  });

  const all = txnQ.data ?? [];
  const debts = debtsQ.data ?? [];

  // Current vs previous month aggregations
  const cur = all.filter((t) => t.occurred_on >= startISO && t.occurred_on < endISO);
  const prev = all.filter((t) => t.occurred_on >= prevStartISO && t.occurred_on < startISO);
  const sum = (arr: Txn[], type: "income" | "expense") =>
    arr.filter((t) => t.type === type).reduce((s, t) => s + Number(t.amount), 0);

  const curInc = sum(cur, "income");
  const curExp = sum(cur, "expense");
  const prevInc = sum(prev, "income");
  const prevExp = sum(prev, "expense");
  const curSav = curInc - curExp;
  const prevSav = prevInc - prevExp;
  const receivable = debts.filter((d) => d.kind === "receivable").reduce((s, d) => s + Number(d.amount), 0);
  const payable = debts.filter((d) => d.kind === "payable").reduce((s, d) => s + Number(d.amount), 0);

  const statCards = [
    { label: "মোট আয়", value: fmtTk(curInc), last: fmtTk(prevInc), pct: pctChange(curInc, prevInc), Icon: Wallet, bg: "bg-emerald-50", fg: "text-emerald-600", val: "text-emerald-600" },
    { label: "মোট ব্যয়", value: fmtTk(curExp), last: fmtTk(prevExp), pct: pctChange(curExp, prevExp), Icon: ArrowDown, bg: "bg-rose-50", fg: "text-rose-500", val: "text-rose-500" },
    { label: "মোট সঞ্চয়", value: fmtTk(curSav), last: fmtTk(prevSav), pct: pctChange(curSav, prevSav), Icon: PiggyBank, bg: "bg-blue-50", fg: "text-blue-600", val: "text-blue-600" },
    { label: "মোট পাওনা", value: fmtTk(receivable), last: "—", pct: { value: "", up: true }, Icon: Users, bg: "bg-orange-50", fg: "text-orange-500", val: "text-orange-500" },
    { label: "মোট দেনা", value: fmtTk(payable), last: "—", pct: { value: "", up: false }, Icon: TrendingDown, bg: "bg-rose-50", fg: "text-rose-500", val: "text-rose-600" },
  ];

  // Donut: current month expenses by category
  const expByCat = new Map<string, number>();
  cur.filter((t) => t.type === "expense").forEach((t) => {
    expByCat.set(t.category, (expByCat.get(t.category) ?? 0) + Number(t.amount));
  });
  const expenses = Array.from(expByCat.entries())
    .map(([label, amount]) => ({ label, amount, color: categoryColor(label) }))
    .sort((a, b) => b.amount - a.amount);
  const totalExp = expenses.reduce((s, e) => s + e.amount, 0) || 1;
  let accDeg = 0;
  const donutSegs = expenses
    .map((e) => {
      const start = accDeg;
      accDeg += (e.amount / totalExp) * 360;
      return `${e.color} ${start}deg ${accDeg}deg`;
    })
    .join(", ") || "#e2e8f0 0deg 360deg";

  // Area chart data
  const chartSeries = useMemo(() => {
    if (chartRange === "সাপ্তাহিক") {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return { d, iso: d.toISOString().slice(0, 10), label: BN_DAYS[d.getDay()] };
      });
      return days.map(({ iso, label }) => {
        const day = all.filter((t) => t.occurred_on === iso);
        return { d: label, inc: sum(day, "income"), exp: sum(day, "expense") };
      });
    }
    if (chartRange === "মাসিক") {
      const y = now.getFullYear();
      return BN_MONTHS.map((m, i) => {
        const mTxns = all.filter((t) => {
          const d = new Date(t.occurred_on);
          return d.getFullYear() === y && d.getMonth() === i;
        });
        return { d: m.slice(0, 3), inc: sum(mTxns, "income"), exp: sum(mTxns, "expense") };
      });
    }
    const years = Array.from(new Set(all.map((t) => new Date(t.occurred_on).getFullYear()))).sort();
    if (years.length === 0) years.push(now.getFullYear());
    return years.map((y) => {
      const yt = all.filter((t) => new Date(t.occurred_on).getFullYear() === y);
      return { d: toBn(y), inc: sum(yt, "income"), exp: sum(yt, "expense") };
    });
  }, [all, chartRange]);

  const recent = all.slice(0, 5);

  type PlanTask = { id: number; task: string; date: string; amount: string; priority: "উচ্চ" | "মাঝারি" | "নিম্ন"; done: boolean };
  const [tasks, setTasks] = useState<PlanTask[]>([
    { id: 1, task: "জুন মাসের বাজেট নির্ধারণ", date: "১ জুন", amount: "৳ ৪০,০০০", priority: "উচ্চ", done: false },
    { id: 2, task: "জরুরি তহবিলে জমা", date: "৫ জুন", amount: "৳ ৫,০০০", priority: "উচ্চ", done: false },
    { id: 3, task: "ল্যাপটপ সঞ্চয় শুরু", date: "১০ জুন", amount: "৳ ৩,০০০", priority: "মাঝারি", done: false },
    { id: 4, task: "বিদ্যুৎ ও গ্যাস বিল", date: "১৫ জুন", amount: "৳ ২,৫০০", priority: "উচ্চ", done: true },
    { id: 5, task: "ভবিষ্যৎ ফান্ডে অবদান", date: "২৫ জুন", amount: "৳ ৬,০০০", priority: "নিম্ন", done: false },
  ]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const emptyDraft = { task: "", date: "", amount: "", priority: "মাঝারি" as PlanTask["priority"] };
  const [draft, setDraft] = useState(emptyDraft);

  const priColor = (p: PlanTask["priority"]) =>
    p === "উচ্চ" ? "bg-rose-50 text-rose-600" : p === "মাঝারি" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600";

  const startAdd = () => { setDraft(emptyDraft); setEditingId(null); setAdding(true); };
  const startEdit = (t: PlanTask) => { setDraft({ task: t.task, date: t.date, amount: t.amount, priority: t.priority }); setEditingId(t.id); setAdding(false); };
  const cancel = () => { setAdding(false); setEditingId(null); setDraft(emptyDraft); };
  const save = () => {
    if (!draft.task.trim()) return;
    if (editingId !== null) {
      setTasks(tasks.map((t) => (t.id === editingId ? { ...t, ...draft } : t)));
    } else {
      setTasks([...tasks, { id: Date.now(), done: false, ...draft }]);
    }
    cancel();
  };
  const remove = (id: number) => setTasks(tasks.filter((t) => t.id !== id));
  const toggle = (id: number) => setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  const renderDraft = () => (
    <div className="p-3 rounded-lg border border-indigo-200 bg-indigo-50/40 space-y-2">
      <input
        autoFocus
        value={draft.task}
        onChange={(e) => setDraft({ ...draft, task: e.target.value })}
        placeholder="কাজের নাম"
        className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
      />
      <div className="grid grid-cols-3 gap-2">
        <input
          value={draft.date}
          onChange={(e) => setDraft({ ...draft, date: e.target.value })}
          placeholder="তারিখ"
          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
        <input
          value={draft.amount}
          onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
          placeholder="৳ পরিমাণ"
          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
        <select
          value={draft.priority}
          onChange={(e) => setDraft({ ...draft, priority: e.target.value as PlanTask["priority"] })}
          className="px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
        >
          <option value="উচ্চ">উচ্চ</option>
          <option value="মাঝারি">মাঝারি</option>
          <option value="নিম্ন">নিম্ন</option>
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={cancel} className="flex items-center gap-1 px-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white hover:bg-slate-50">
          <X className="w-3 h-3" /> বাতিল
        </button>
        <button onClick={save} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          <Check className="w-3 h-3" /> সেভ
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: "oklch(0.97 0.005 250)" }}>
      <Sidebar />

      {/* Main */}
      <main className="flex-1 p-6 overflow-y-auto h-screen">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-800">মাসিক ড্যাশবোর্ড</h1>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-slate-200 text-sm">
              <Calendar className="w-4 h-4 text-slate-500" /> মে ২০২৪ <ChevronDown className="w-4 h-4" />
            </button>
            <div className="flex-1"></div>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">
              রিপোর্ট ডাউনলোড <Download className="w-4 h-4" />
            </button>
            <button className="relative p-2 bg-white rounded-lg border border-slate-200">
              <Bell className="w-4 h-4 text-slate-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span>
            </button>
            <div className="flex items-center gap-2 px-2 py-1 bg-white rounded-lg border border-slate-200">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-600"></div>
              <span className="text-sm">আপনার নাম</span>
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          {statCards.map(s => (
            <div key={s.label} className="bg-white rounded-xl p-5 border border-slate-200">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-11 h-11 rounded-full ${s.bg} flex items-center justify-center`}>
                  <s.Icon className={`w-5 h-5 ${s.fg}`} />
                </div>
                <div>
                  <div className="text-sm text-slate-500">{s.label}</div>
                  <div className={`text-xl font-bold ${s.val}`}>{s.value}</div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                <span className="text-slate-500">গত মাস: {s.last}</span>
                {s.pct.value && (
                  <span className={`flex items-center gap-1 ${s.pct.up ? "text-emerald-600" : "text-rose-500"}`}>
                    {s.pct.up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}{s.pct.value}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Middle row */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Expense breakdown */}
          <div className="bg-white rounded-xl p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">ব্যয়ের খাতভিত্তিক বিশ্লেষণ</h3>
              <button className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs">
                খাত অনুযায়ী <ChevronDown className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-center gap-6">
              <div className="relative w-44 h-44 flex-shrink-0">
                <div className="w-full h-full rounded-full" style={{ background: `conic-gradient(${donutSegs})` }}></div>
                <div className="absolute inset-6 bg-white rounded-full flex flex-col items-center justify-center">
                  <div className="text-xs text-slate-500">মোট ব্যয়</div>
                  <div className="font-bold text-slate-800">{fmtTk(curExp)}</div>
                </div>
              </div>
              <div className="flex-1 space-y-2.5">
                {expenses.length === 0 && (
                  <div className="text-sm text-slate-400">এই মাসে কোনো ব্যয় নেই</div>
                )}
                {expenses.map(e => (
                  <div key={e.label} className="flex items-center text-sm">
                    <span className="w-2.5 h-2.5 rounded-full mr-2" style={{ background: e.color }}></span>
                    <span className="flex-1 text-slate-700">{e.label}</span>
                    <span className="w-20 text-right font-medium text-slate-800">{fmtTk(e.amount)}</span>
                    <span className="w-14 text-right text-slate-500">{toBn(((e.amount / totalExp) * 100).toFixed(1))}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Income vs Expense chart */}
          <div className="bg-white rounded-xl p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">আয় / ব্যয় চার্ট</h3>
              <select
                value={chartRange}
                onChange={(e) => setChartRange(e.target.value as typeof chartRange)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="সাপ্তাহিক">সাপ্তাহিক</option>
                <option value="মাসিক">মাসিক</option>
                <option value="বার্ষিক">বার্ষিক</option>
              </select>
            </div>
            <div className="h-56 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="d" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                    formatter={(v: number, name: string) => [`৳ ${v.toLocaleString()}`, name === "inc" ? "আয়" : "ব্যয়"]}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                    formatter={(v) => (v === "inc" ? "আয়" : "ব্যয়")}
                  />
                  <Area type="monotone" dataKey="inc" stroke="#10b981" strokeWidth={2} fill="url(#incGrad)" />
                  <Area type="monotone" dataKey="exp" stroke="#f43f5e" strokeWidth={2} fill="url(#expGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent transactions + Future budget */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">সাম্প্রতিক লেনদেন</h3>
              <div className="flex items-center gap-2">
                <Link to="/transactions" className="text-sm text-indigo-600 hover:underline">সব দেখুন</Link>
                <Link to="/transactions" className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                  <Plus className="w-3 h-3" /> নতুন
                </Link>
              </div>
            </div>
            <div className="space-y-3">
              {txnQ.isLoading && <div className="text-sm text-slate-400 py-4">লোড হচ্ছে...</div>}
              {!txnQ.isLoading && recent.length === 0 && (
                <div className="text-sm text-slate-400 py-4 text-center">কোনো লেনদেন নেই — "নতুন" এ ক্লিক করুন</div>
              )}
              {recent.map((t) => {
                const income = t.type === "income";
                return (
                  <div key={t.id} className="flex items-center gap-2 py-1">
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

          {/* Future budget & plan - task list */}
          <div className="bg-white rounded-xl p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">আগামী বাজেট ও পরিকল্পনা</h3>
              <button
                onClick={startAdd}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                <Plus className="w-3 h-3" /> নতুন
              </button>
            </div>
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {adding && renderDraft()}
              {tasks.map((t) =>
                editingId === t.id ? (
                  <div key={t.id}>{renderDraft()}</div>
                ) : (
                  <div key={t.id} className="group flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition">
                    <input
                      type="checkbox"
                      checked={t.done}
                      onChange={() => toggle(t.id)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${t.done ? "text-slate-400 line-through" : "text-slate-800"}`}>{t.task}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{t.date} · {t.amount}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${priColor(t.priority)}`}>{t.priority}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => startEdit(t)} className="p-1.5 rounded-md hover:bg-indigo-50 text-slate-500 hover:text-indigo-600" title="এডিট">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => remove(t.id)} className="p-1.5 rounded-md hover:bg-rose-50 text-slate-500 hover:text-rose-600" title="মুছুন">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              )}
              {tasks.length === 0 && !adding && (
                <div className="text-center text-sm text-slate-400 py-6">কোনো পরিকল্পনা নেই</div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-3 gap-4">
          {/* Monthly goals */}
          <div className="bg-white rounded-xl p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">মাসিক লক্ষ্য</h3>
              <a className="text-sm text-indigo-600 cursor-pointer">সব দেখুন →</a>
            </div>
            <div className="space-y-4">
              {goals.map(g => (
                <div key={g.label} className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full ${g.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <g.Icon className={`w-4 h-4 ${g.iconFg}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-slate-700">{g.label}</span>
                      <span className="text-slate-500">{g.current} / {g.target}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${g.color} rounded-full`} style={{ width: `${g.pct}%` }}></div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-600 w-10 text-right">{g.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Receivable/Payable */}
          <div className="bg-white rounded-xl p-5 border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4">পাওনা / দেনা সারাংশ</h3>
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-emerald-50/60 border border-emerald-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                    <Users className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-600">মোট পাওনা</div>
                    <div className="font-bold text-emerald-700">৳ ১২,৪০০</div>
                  </div>
                </div>
                <a className="text-xs text-indigo-600 mt-2 inline-block cursor-pointer">বিস্তারিত দেখুন</a>
              </div>
              <div className="p-4 rounded-lg bg-rose-50/60 border border-rose-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                    <Users className="w-5 h-5 text-rose-500" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-600">মোট দেনা</div>
                    <div className="font-bold text-rose-600">৳ ৫,৮০০</div>
                  </div>
                </div>
                <a className="text-xs text-indigo-600 mt-2 inline-block cursor-pointer">বিস্তারিত দেখুন</a>
              </div>
            </div>
          </div>

          {/* Quick note */}
          <div className="bg-white rounded-xl p-5 border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <StickyNote className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-slate-800">দ্রুত নোট</h3>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-3 text-xs text-slate-700">
              <ul className="space-y-1.5 list-disc pl-4">
                <li>এই মাসে অপ্রয়োজনীয় খরচ কমাতে হবে</li>
                <li>জরুরি তহবিলে আরও টাকা জমা দিতে হবে</li>
                <li>নতুন ল্যাপটপ কেনার জন্য সঞ্চয় করতে হবে</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <input className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="নোট লিখুন..." />
              <button className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium">সেভ</button>
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-slate-500 mt-6">
          © ২০২৪ আমার হিসাব. সর্বস্বত্ব সংরক্ষিত. <span className="text-rose-500">♥</span>
        </div>
      </main>
    </div>
  );
}
