import { createFileRoute } from "@tanstack/react-router";
import {
  Wallet, Calendar, Settings, Download, Bell, ChevronDown,
  ArrowDown, ArrowUp, PiggyBank, BookOpen, House, StickyNote
} from "lucide-react";
import { Users, TrendingDown } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";

export const Route = createFileRoute("/")({ component: Dashboard });

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

          {/* Recent transactions */}
          <div className="bg-white rounded-xl p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">সাম্প্রতিক লেনদেন</h3>
              <a className="text-sm text-indigo-600 cursor-pointer">সব দেখুন</a>
            </div>
            <div className="space-y-3">
              {transactions.map((t, i) => (
                <div key={i} className="flex items-center gap-3 py-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${t.income ? "bg-emerald-50" : "bg-rose-50"}`}>
                    {t.income ? <ArrowUp className="w-4 h-4 text-emerald-600" /> : <ArrowDown className="w-4 h-4 text-rose-500" />}
                  </div>
                  <span className="font-medium text-slate-800 flex-1">{t.label}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full ${t.income ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>{t.tag}</span>
                  <span className="text-xs text-slate-500 w-24 text-right">{t.date}</span>
                  <span className={`font-bold w-20 text-right ${t.income ? "text-emerald-600" : "text-rose-500"}`}>{t.amount}</span>
                </div>
              ))}
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
