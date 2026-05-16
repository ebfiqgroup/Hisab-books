import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  Wallet, Calendar, Download, Bell, ChevronDown, Users, TrendingDown,
  ArrowDown, ArrowUp, PiggyBank, BookOpen, House, StickyNote, Plus, Pencil, Trash2, Check, X
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";

export const Route = createFileRoute("/")({ component: Dashboard });

const chartData = {
  সাপ্তাহিক: [
    { d: "সোম", inc: 8500, exp: 5200 },
    { d: "মঙ্গল", inc: 12000, exp: 6800 },
    { d: "বুধ", inc: 9500, exp: 4200 },
    { d: "বৃহঃ", inc: 15000, exp: 7500 },
    { d: "শুক্র", inc: 11000, exp: 8800 },
    { d: "শনি", inc: 6500, exp: 3500 },
    { d: "রবি", inc: 3000, exp: 2800 },
  ],
  মাসিক: [
    { d: "জানু", inc: 58000, exp: 34000 },
    { d: "ফেব্রু", inc: 62500, exp: 36200 },
    { d: "মার্চ", inc: 58300, exp: 34620 },
    { d: "এপ্রিল", inc: 61200, exp: 37100 },
    { d: "মে", inc: 65450, exp: 38750 },
    { d: "জুন", inc: 67000, exp: 40000 },
  ],
  বার্ষিক: [
    { d: "২০২০", inc: 520000, exp: 320000 },
    { d: "২০২১", inc: 610000, exp: 380000 },
    { d: "২০২২", inc: 685000, exp: 410000 },
    { d: "২০২৩", inc: 720000, exp: 445000 },
    { d: "২০২৪", inc: 785500, exp: 462000 },
  ],
};

const stats = [
  { label: "মোট আয়", value: "৳ ৬৫,৪৫০", last: "৳ ৫৮,৩০০", pct: "12.28%", color: "income", Icon: Wallet, bg: "bg-emerald-50", fg: "text-emerald-600", val: "text-emerald-600" },
  { label: "মোট ব্যয়", value: "৳ ৩৮,৭৫০", last: "৳ ৩৪,৬২০", pct: "11.94%", color: "expense", Icon: ArrowDown, bg: "bg-rose-50", fg: "text-rose-500", val: "text-rose-500" },
  { label: "মোট সঞ্চয়", value: "৳ ২৬,৭০০", last: "৳ ২৩,৬৮০", pct: "12.75%", color: "savings", Icon: PiggyBank, bg: "bg-blue-50", fg: "text-blue-600", val: "text-blue-600" },
  { label: "মোট পাওনা", value: "৳ ১২,৪০০", last: "৳ ৯,৬০০", pct: "29.17%", color: "receivable", Icon: Users, bg: "bg-orange-50", fg: "text-orange-500", val: "text-orange-500" },
  { label: "মোট দেনা", value: "৳ ৫,৮০০", last: "৳ ৭,২০০", pct: "19.44%", color: "payable", Icon: TrendingDown, bg: "bg-rose-50", fg: "text-rose-500", val: "text-rose-600" },
];

const expenses = [
  { label: "খাবার", amount: "৳ ১২,৪৫০", pct: "32.1%", color: "#10b981", deg: 115 },
  { label: "বাসা ভাড়া", amount: "৳ ৮,০০০", pct: "20.6%", color: "#f43f5e", deg: 74 },
  { label: "পরিবহন", amount: "৳ ৪,৬৫০", pct: "12.0%", color: "#6366f1", deg: 43 },
  { label: "শিক্ষা", amount: "৳ ৩,৮০০", pct: "9.8%", color: "#3b82f6", deg: 35 },
  { label: "বিনোদন", amount: "৳ ৩,২০০", pct: "8.3%", color: "#2563eb", deg: 30 },
  { label: "স্বাস্থ্য", amount: "৳ ২,৮০০", pct: "6.2%", color: "#f97316", deg: 22 },
  { label: "অন্যান্য", amount: "৳ ৪,২৫০", pct: "10.9%", color: "#9ca3af", deg: 41 },
];

const transactions = [
  { label: "বেতন", tag: "আয়", date: "৩১ মে ২০২৪", amount: "৳ ৬৫,০০০", income: true },
  { label: "বাসা ভাড়া", tag: "ব্যয়", date: "২৮ মে ২০২৪", amount: "৳ ৮,০০০", income: false },
  { label: "বাজার খরচ", tag: "ব্যয়", date: "২৬ মে ২০২৪", amount: "৳ ২,৮৫০", income: false },
  { label: "বিদ্যুৎ বিল", tag: "ব্যয়", date: "২৩ মে ২০২৪", amount: "৳ ১,২৮০", income: false },
  { label: "ফ্রিল্যান্স পেমেন্ট", tag: "আয়", date: "২০ মে ২০২৪", amount: "৳ ৫,০০০", income: true },
];

const goals = [
  { Icon: PiggyBank, label: "সঞ্চয় লক্ষ্য", current: "৳ ২৬,৭০০", target: "৳ ৩০,০০০", pct: 89, color: "bg-emerald-500", iconBg: "bg-rose-100", iconFg: "text-rose-500" },
  { Icon: BookOpen, label: "জরুরি তহবিল", current: "৳ ১২,০০০", target: "৳ ২০,০০০", pct: 60, color: "bg-blue-500", iconBg: "bg-blue-100", iconFg: "text-blue-600" },
  { Icon: House, label: "ভবিষ্যৎ ফান্ড", current: "৳ ৮,০০০", target: "৳ ১৫,০০০", pct: 53, color: "bg-orange-500", iconBg: "bg-orange-100", iconFg: "text-orange-500" },
];

function Dashboard() {
  const [chartRange, setChartRange] = useState<keyof typeof chartData>("সাপ্তাহিক");
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

  const DraftForm = () => (
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
  // Build conic gradient
  let acc = 0;
  const segs = expenses.map(e => {
    const start = acc;
    acc += e.deg;
    return `${e.color} ${start}deg ${acc}deg`;
  }).join(", ");
  // scale to 360
  const scale = 360 / acc;
  let acc2 = 0;
  const segs2 = expenses.map(e => {
    const start = acc2;
    acc2 += e.deg * scale;
    return `${e.color} ${start}deg ${acc2}deg`;
  }).join(", ");

  return (
    <div className="min-h-screen flex" style={{ background: "oklch(0.97 0.005 250)" }}>
      <Sidebar />

      {/* Main */}
      <main className="flex-1 p-6">
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
          {stats.map(s => (
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
                <span className="text-emerald-600 flex items-center gap-1"><ArrowUp className="w-3 h-3" />{s.pct}</span>
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
                <div className="w-full h-full rounded-full" style={{ background: `conic-gradient(${segs2})` }}></div>
                <div className="absolute inset-6 bg-white rounded-full flex flex-col items-center justify-center">
                  <div className="text-xs text-slate-500">মোট ব্যয়</div>
                  <div className="font-bold text-slate-800">৳ ৩৮,৭৫০</div>
                </div>
              </div>
              <div className="flex-1 space-y-2.5">
                {expenses.map(e => (
                  <div key={e.label} className="flex items-center text-sm">
                    <span className="w-2.5 h-2.5 rounded-full mr-2" style={{ background: e.color }}></span>
                    <span className="flex-1 text-slate-700">{e.label}</span>
                    <span className="w-20 text-right font-medium text-slate-800">{e.amount}</span>
                    <span className="w-14 text-right text-slate-500">{e.pct}</span>
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
                onChange={(e) => setChartRange(e.target.value as keyof typeof chartData)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="সাপ্তাহিক">সাপ্তাহিক</option>
                <option value="মাসিক">মাসিক</option>
                <option value="বার্ষিক">বার্ষিক</option>
              </select>
            </div>
            <div className="h-56 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData[chartRange]} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
              <a className="text-sm text-indigo-600 cursor-pointer">সব দেখুন</a>
            </div>
            <div className="space-y-3">
              {transactions.map((t, i) => (
                <div key={i} className="flex items-center gap-2 py-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${t.income ? "bg-emerald-50" : "bg-rose-50"}`}>
                    {t.income ? <ArrowUp className="w-4 h-4 text-emerald-600" /> : <ArrowDown className="w-4 h-4 text-rose-500" />}
                  </div>
                  <span className="font-medium text-slate-800 flex-1 text-sm">{t.label}</span>
                  <span className="text-xs text-slate-500">{t.date}</span>
                  <span className={`font-bold text-sm w-20 text-right ${t.income ? "text-emerald-600" : "text-rose-500"}`}>{t.amount}</span>
                </div>
              ))}
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
              {adding && <DraftForm />}
              {tasks.map((t) =>
                editingId === t.id ? (
                  <DraftForm key={t.id} />
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
