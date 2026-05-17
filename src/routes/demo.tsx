import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Wallet, PiggyBank, BarChart3, ArrowLeft, Plus, Trash2,
  TrendingUp, TrendingDown, Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "লাইভ ডেমো — আমার হিসাব" },
      { name: "description", content: "আমার হিসাব অ্যাপের ইন্টারঅ্যাক্টিভ লাইভ ডেমো। লগইন ছাড়াই আয়-ব্যয় যোগ করে দেখুন।" },
    ],
  }),
  component: DemoPage,
});

type Txn = { id: string; type: "income" | "expense"; category: string; amount: number; note: string };

const SEED: Txn[] = [
  { id: "1", type: "income",  category: "বেতন",        amount: 60000, note: "মে মাসের বেতন" },
  { id: "2", type: "expense", category: "বাজার",       amount: 12500, note: "সাপ্তাহিক বাজার" },
  { id: "3", type: "expense", category: "বাড়িভাড়া",   amount: 18000, note: "মে ভাড়া" },
  { id: "4", type: "income",  category: "ফ্রিল্যান্স",  amount: 22000, note: "ক্লায়েন্ট প্রকল্প" },
  { id: "5", type: "expense", category: "যাতায়াত",     amount: 3200,  note: "অফিস যাতায়াত" },
  { id: "6", type: "expense", category: "বিনোদন",      amount: 1800,  note: "সিনেমা ও খাবার" },
];

const CATEGORIES = {
  income: ["বেতন", "ফ্রিল্যান্স", "উপহার", "ব্যবসা", "অন্যান্য"],
  expense: ["বাজার", "বাড়িভাড়া", "যাতায়াত", "বিনোদন", "স্বাস্থ্য", "শিক্ষা", "অন্যান্য"],
};

function fmt(n: number) { return "৳ " + n.toLocaleString("bn-BD"); }

function DemoPage() {
  const [txns, setTxns] = useState<Txn[]>(SEED);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("বাজার");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const totals = useMemo(() => {
    const income = txns.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = txns.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [txns]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    txns.filter(t => t.type === "expense").forEach(t => {
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [txns]);

  const maxCat = byCategory[0]?.[1] ?? 1;

  function add(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    setTxns(prev => [
      { id: Math.random().toString(36).slice(2), type, category, amount: amt, note: note || category },
      ...prev,
    ]);
    setAmount("");
    setNote("");
  }

  function remove(id: string) {
    setTxns(prev => prev.filter(t => t.id !== id));
  }

  function reset() {
    setTxns(SEED);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-page)" }}>
      <header className="sticky top-0 z-30 backdrop-blur-md" style={{ background: "color-mix(in oklab, var(--brand-ivory) 80%, transparent)", borderBottom: "1px solid var(--brand-line)" }}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--brand-ink)" }}>
            <ArrowLeft className="w-4 h-4" /> হোমে ফিরুন
          </Link>
          <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full" style={{ background: "color-mix(in oklab, var(--brand-emerald-700) 12%, transparent)", color: "var(--brand-emerald-700)" }}>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: "var(--brand-emerald-700)" }} />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "var(--brand-emerald-700)" }} />
            </span>
            লাইভ ডেমো — কোনো ডেটা সংরক্ষিত হবে না
          </div>
          <Link to="/auth" className="text-sm px-4 py-2 rounded-xl text-white" style={{ background: "var(--gradient-brand)" }}>
            শুরু করুন
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-8">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl" style={{ fontFamily: "var(--font-display)", color: "var(--brand-ink)" }}>
            ইন্টারঅ্যাক্টিভ ড্যাশবোর্ড
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--brand-ink-soft)" }}>
            নিচে আয়-ব্যয় যোগ বা মুছে দেখুন — সারাংশ, চার্ট ও AI পরামর্শ সঙ্গে সঙ্গে আপডেট হবে।
          </p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SummaryCard label="মোট আয়" value={fmt(totals.income)} color="var(--brand-emerald-700)" Icon={TrendingUp} />
          <SummaryCard label="মোট ব্যয়" value={fmt(totals.expense)} color="#e11d48" Icon={TrendingDown} />
          <SummaryCard label="ব্যালেন্স" value={fmt(totals.balance)} color={totals.balance >= 0 ? "#2563eb" : "#e11d48"} Icon={Wallet} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add form */}
          <section className="brand-card p-5 lg:col-span-1">
            <h2 className="text-lg mb-4" style={{ fontFamily: "var(--font-display)" }}>নতুন এন্ট্রি যোগ করুন</h2>
            <form onSubmit={add} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {(["expense", "income"] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setType(t); setCategory(CATEGORIES[t][0]); }}
                    className="px-3 py-2 rounded-lg text-sm border"
                    style={{
                      borderColor: "var(--brand-line)",
                      background: type === t ? (t === "income" ? "color-mix(in oklab, var(--brand-emerald-700) 12%, transparent)" : "color-mix(in oklab, #e11d48 12%, transparent)") : "white",
                      color: type === t ? (t === "income" ? "var(--brand-emerald-700)" : "#e11d48") : "var(--brand-ink)",
                    }}
                  >
                    {t === "income" ? "আয়" : "ব্যয়"}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--brand-ink-soft)" }}>ক্যাটাগরি</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-white text-sm" style={{ borderColor: "var(--brand-line)" }}>
                  {CATEGORIES[type].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--brand-ink-soft)" }}>পরিমাণ (৳)</label>
                <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="যেমন ৫০০" className="w-full px-3 py-2 rounded-lg border bg-white text-sm" style={{ borderColor: "var(--brand-line)" }} required />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--brand-ink-soft)" }}>নোট (ঐচ্ছিক)</label>
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="সংক্ষিপ্ত বিবরণ" className="w-full px-3 py-2 rounded-lg border bg-white text-sm" style={{ borderColor: "var(--brand-line)" }} />
              </div>
              <button type="submit" className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium" style={{ background: "var(--gradient-brand)" }}>
                <Plus className="w-4 h-4" /> যোগ করুন
              </button>
              <button type="button" onClick={reset} className="w-full text-xs underline" style={{ color: "var(--brand-ink-soft)" }}>
                ডেমো রিসেট করুন
              </button>
            </form>
          </section>

          {/* Chart + AI */}
          <section className="lg:col-span-2 space-y-6">
            <div className="brand-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg" style={{ fontFamily: "var(--font-display)" }}>ক্যাটাগরিভিত্তিক ব্যয়</h2>
                <BarChart3 className="w-4 h-4" style={{ color: "var(--brand-ink-soft)" }} />
              </div>
              {byCategory.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--brand-ink-soft)" }}>এখনো কোনো ব্যয় নেই।</p>
              ) : (
                <ul className="space-y-3">
                  {byCategory.map(([cat, val]) => (
                    <li key={cat}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span style={{ color: "var(--brand-ink)" }}>{cat}</span>
                        <span style={{ color: "var(--brand-ink-soft)" }}>{fmt(val)}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--brand-line)" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${(val / maxCat) * 100}%`, background: "var(--gradient-brand)" }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="brand-card p-5" style={{ background: "color-mix(in oklab, var(--brand-emerald-700) 6%, white)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4" style={{ color: "var(--brand-emerald-700)" }} />
                <h2 className="text-base" style={{ fontFamily: "var(--font-display)" }}>AI পরামর্শ</h2>
              </div>
              <p className="text-sm" style={{ color: "var(--brand-ink)" }}>
                {totals.balance < 0
                  ? "আপনার ব্যয় আয়কে ছাড়িয়ে গেছে। সবচেয়ে বড় খাতে কমানোর সুযোগ আছে কি না দেখুন।"
                  : totals.expense > totals.income * 0.8
                    ? "ব্যয় আয়ের ৮০%-এর বেশি। একটু সঞ্চয়ের লক্ষ্য সেট করতে পারেন।"
                    : `চমৎকার! আপনি এ মাসে ${fmt(totals.balance)} সঞ্চয় করছেন। পরবর্তী লক্ষ্যে এগিয়ে চলুন।`}
              </p>
            </div>

            <div className="brand-card p-5">
              <h2 className="text-lg mb-4" style={{ fontFamily: "var(--font-display)" }}>সাম্প্রতিক লেনদেন</h2>
              <ul className="divide-y" style={{ borderColor: "var(--brand-line)" }}>
                {txns.map(t => (
                  <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: t.type === "income" ? "color-mix(in oklab, var(--brand-emerald-700) 12%, transparent)" : "color-mix(in oklab, #e11d48 12%, transparent)" }}>
                        {t.type === "income" ? <PiggyBank className="w-4 h-4" style={{ color: "var(--brand-emerald-700)" }} /> : <Wallet className="w-4 h-4" style={{ color: "#e11d48" }} />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm truncate" style={{ color: "var(--brand-ink)" }}>{t.note}</div>
                        <div className="text-xs" style={{ color: "var(--brand-ink-soft)" }}>{t.category}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-medium" style={{ color: t.type === "income" ? "var(--brand-emerald-700)" : "#e11d48" }}>
                        {t.type === "income" ? "+" : "−"} {fmt(t.amount)}
                      </span>
                      <button type="button" onClick={() => remove(t.id)} className="p-1.5 rounded-md hover:bg-black/5" aria-label="মুছুন">
                        <Trash2 className="w-4 h-4" style={{ color: "var(--brand-ink-soft)" }} />
                      </button>
                    </div>
                  </li>
                ))}
                {txns.length === 0 && (
                  <li className="py-6 text-center text-sm" style={{ color: "var(--brand-ink-soft)" }}>
                    কোনো লেনদেন নেই। প্রথম এন্ট্রি যোগ করুন।
                  </li>
                )}
              </ul>
            </div>
          </section>
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm mb-3" style={{ color: "var(--brand-ink-soft)" }}>ডেমো পছন্দ হয়েছে? বিনামূল্যে অ্যাকাউন্ট তৈরি করে আপনার নিজের ডেটা সংরক্ষণ করুন।</p>
          <Link to="/auth" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-white text-sm font-medium" style={{ background: "var(--gradient-brand)" }}>
            বিনামূল্যে শুরু করুন
          </Link>
        </div>
      </main>
    </div>
  );
}

function SummaryCard({ label, value, color, Icon }: { label: string; value: string; color: string; Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }) {
  return (
    <div className="brand-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs" style={{ color: "var(--brand-ink-soft)" }}>{label}</div>
          <div className="text-2xl mt-1" style={{ fontFamily: "var(--font-display)", color }}>{value}</div>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `color-mix(in oklab, ${color} 12%, transparent)` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </div>
  );
}