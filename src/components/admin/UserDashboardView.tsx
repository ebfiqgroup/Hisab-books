import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminGetUserDashboard } from "@/lib/admin-users.functions";
import { fmtTk, monthBounds, BN_MONTHS } from "@/lib/finance";
import {
  Wallet, ArrowDown, PiggyBank, Users, TrendingDown,
  Target, StickyNote, ListTodo, ArrowLeftRight, RefreshCw, Mail, Download, X, Search,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { useAvatarUrl } from "@/lib/avatar-url";

type Txn = { id: string; type: "income" | "expense"; category: string; amount: number; occurred_on: string; note: string | null };
type Debt = { id: string; kind: "receivable" | "payable"; amount: number; settled: boolean; person: string; due_date: string | null; note: string | null };
type Goal = { id: string; label: string; target: number; current: number; color: string; deadline: string | null };
type Note = { id: string; body: string; created_at: string };
type Task = { id: string; task: string; due_text: string | null; amount_text: string | null; priority: string; done: boolean };
type Budget = { id: string; category: string; monthly_limit: number; label: string | null };
type Profile = { id: string; full_name: string | null; avatar_url: string | null; status: string; created_at: string };

export function UserDashboardView({
  userId,
  showHeader = true,
  showToolbar = true,
  compact = false,
}: {
  userId: string;
  showHeader?: boolean;
  showToolbar?: boolean;
  compact?: boolean;
}) {
  const getDashboard = useServerFn(adminGetUserDashboard);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [detail, setDetail] = useState<null | { key: string; title: string }>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await getDashboard({ data: { user_id: userId } });
      setProfile((data.profile as Profile) || null);
      setEmail(data.email);
      setTxns((data.txns as Txn[]) || []);
      setDebts((data.debts as Debt[]) || []);
      setGoals((data.goals as Goal[]) || []);
      setNotes((data.notes as Note[]) || []);
      setTasks((data.tasks as Task[]) || []);
      setBudgets((data.budgets as Budget[]) || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId]);

  const now = new Date();
  const chartSeries = useMemo(() => {
    const y = now.getFullYear();
    return BN_MONTHS.map((m, i) => {
      const mTxns = txns.filter(t => { const d = new Date(t.occurred_on); return d.getFullYear() === y && d.getMonth() === i; });
      const sumT = (arr: Txn[], type: "income" | "expense") => arr.filter(t => t.type === type).reduce((s, t) => s + Number(t.amount), 0);
      return { d: m.slice(0, 3), আয়: sumT(mTxns, "income"), ব্যয়: sumT(mTxns, "expense") };
    });
    // eslint-disable-next-line
  }, [txns]);

  if (loading) return <div className="py-10 text-center text-slate-500">লোড হচ্ছে…</div>;
  if (!profile) return <div className="py-10 text-center text-slate-500">ইউজার পাওয়া যায়নি</div>;

  const { startISO, endISO, prevStartISO } = monthBounds(now);
  const sum = (arr: Txn[], type: "income" | "expense") => arr.filter(t => t.type === type).reduce((s, t) => s + Number(t.amount), 0);
  const cur = txns.filter(t => t.occurred_on >= startISO && t.occurred_on < endISO);
  const prev = txns.filter(t => t.occurred_on >= prevStartISO && t.occurred_on < startISO);
  const curInc = sum(cur, "income"), curExp = sum(cur, "expense");
  const prevInc = sum(prev, "income"), prevExp = sum(prev, "expense");
  const totalInc = sum(txns, "income"), totalExp = sum(txns, "expense");
  const receivable = debts.filter(d => !d.settled && d.kind === "receivable").reduce((s, d) => s + Number(d.amount), 0);
  const payable = debts.filter(d => !d.settled && d.kind === "payable").reduce((s, d) => s + Number(d.amount), 0);

  const cards = [
    { key: "income", label: "এই মাসের আয়", value: fmtTk(curInc), last: `গত: ${fmtTk(prevInc)}`, Icon: Wallet, c: "emerald" },
    { key: "expense", label: "এই মাসের ব্যয়", value: fmtTk(curExp), last: `গত: ${fmtTk(prevExp)}`, Icon: ArrowDown, c: "rose" },
    { key: "savings", label: "এই মাসের সঞ্চয়", value: fmtTk(curInc - curExp), last: `গত: ${fmtTk(prevInc - prevExp)}`, Icon: PiggyBank, c: "blue" },
    { key: "receivable", label: "মোট পাওনা", value: fmtTk(receivable), last: "", Icon: Users, c: "orange" },
    { key: "payable", label: "মোট দেনা", value: fmtTk(payable), last: "", Icon: TrendingDown, c: "rose" },
    { key: "all", label: "সর্বমোট লেনদেন", value: String(txns.length), last: `আয় ${fmtTk(totalInc)} · ব্যয় ${fmtTk(totalExp)}`, Icon: ArrowLeftRight, c: "indigo" },
  ] as const;

  const cBg: Record<string, string> = { emerald: "bg-emerald-50 text-emerald-600", rose: "bg-rose-50 text-rose-500", blue: "bg-blue-50 text-blue-600", orange: "bg-orange-50 text-orange-500", indigo: "bg-indigo-50 text-indigo-600" };

  const exportCSV = () => {
    const rows = [["তারিখ", "ধরন", "ক্যাটাগরি", "পরিমাণ", "নোট"]];
    txns.forEach(t => rows.push([t.occurred_on, t.type, t.category, String(t.amount), t.note || ""]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${profile?.full_name || userId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chartH = compact ? "h-48" : "h-64";

  return (
    <div className="space-y-4">
      {showToolbar && (
        <div className="flex justify-end gap-2">
          <button onClick={exportCSV} disabled={txns.length === 0} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border text-xs hover:shadow-sm disabled:opacity-50" style={{ borderColor: "var(--brand-line)" }}>
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border text-xs hover:shadow-sm" style={{ borderColor: "var(--brand-line)" }}>
            <RefreshCw className="w-3.5 h-3.5" /> রিফ্রেশ
          </button>
        </div>
      )}

      {showHeader && (
        <div className="brand-card p-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold overflow-hidden shrink-0" style={{ background: "var(--gradient-brand)" }}>
            {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : (profile.full_name || "?").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-semibold truncate" style={{ fontFamily: "var(--font-display)" }}>{profile.full_name || "—"}</div>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
              <span className="font-mono">{profile.id.slice(0, 12)}…</span>
              {email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {email}</span>}
              <span>যোগদান: {new Date(profile.created_at).toLocaleDateString("bn-BD")}</span>
              <span className={`px-2 py-0.5 rounded-full font-medium ${profile.status === "approved" ? "bg-emerald-100 text-emerald-700" : profile.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                {profile.status === "approved" ? "অনুমোদিত" : profile.status === "pending" ? "পেন্ডিং" : "সাসপেন্ডেড"}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {cards.map(s => (
          <button
            key={s.label}
            onClick={() => setDetail({ key: s.key, title: s.label })}
            className="bg-white rounded-xl p-3 border border-slate-200 text-left hover:shadow-md hover:border-emerald-300 transition"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${cBg[s.c]}`}><s.Icon className="w-3.5 h-3.5" /></div>
              <div className="text-[11px] text-slate-500">{s.label}</div>
            </div>
            <div className="text-base font-bold text-slate-800">{s.value}</div>
            {s.last && <div className="text-[10px] text-slate-400 mt-0.5">{s.last}</div>}
          </button>
        ))}
      </div>

      <div className="brand-card p-4">
        <h3 className="font-semibold mb-2 text-sm" style={{ fontFamily: "var(--font-display)" }}>মাসিক আয়-ব্যয় ({now.getFullYear()})</h3>
        <div className={chartH}>
          <ResponsiveContainer>
            <AreaChart data={chartSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="d" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="আয়" stroke="#10b981" fill="#10b98133" />
              <Area type="monotone" dataKey="ব্যয়" stroke="#f43f5e" fill="#f43f5e33" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Section title="সাম্প্রতিক লেনদেন" icon={<ArrowLeftRight className="w-4 h-4" />} count={txns.length}>
          {txns.length === 0 ? <Empty text="কোনো লেনদেন নেই" /> : (
            <>
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ক্যাটাগরি/নোট সার্চ…" className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border" style={{ borderColor: "var(--brand-line)" }} />
              </div>
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[11px] text-slate-500 border-b" style={{ borderColor: "var(--brand-line)" }}>
                      <th className="py-2">তারিখ</th><th>ক্যাটাগরি</th><th className="text-right">পরিমাণ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txns.filter(t => !search || t.category.toLowerCase().includes(search.toLowerCase()) || (t.note || "").toLowerCase().includes(search.toLowerCase())).map(t => (
                      <tr key={t.id} className="border-b last:border-0" style={{ borderColor: "var(--brand-line)" }}>
                        <td className="py-1.5 text-slate-500">{new Date(t.occurred_on).toLocaleDateString("bn-BD")}</td>
                        <td className="py-1.5">{t.category}</td>
                        <td className={`py-1.5 text-right font-medium ${t.type === "income" ? "text-emerald-600" : "text-rose-500"}`}>
                          {t.type === "income" ? "+" : "−"} {fmtTk(Number(t.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Section>

        <Section title="লক্ষ্য" icon={<Target className="w-4 h-4" />} count={goals.length}>
          {goals.length === 0 ? <Empty text="কোনো লক্ষ্য নেই" /> : (
            <div className="space-y-2">
              {goals.map(g => {
                const pct = Math.min(100, Math.round((Number(g.current) / Math.max(1, Number(g.target))) * 100));
                return (
                  <div key={g.id} className="p-2.5 rounded-lg border" style={{ borderColor: "var(--brand-line)" }}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{g.label}</span>
                      <span className="text-slate-500">{fmtTk(Number(g.current))} / {fmtTk(Number(g.target))}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section title="দেনা / পাওনা" icon={<Users className="w-4 h-4" />} count={debts.length}>
          {debts.length === 0 ? <Empty text="কোনো দেনা-পাওনা নেই" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[11px] text-slate-500 border-b" style={{ borderColor: "var(--brand-line)" }}>
                    <th className="py-2">ব্যক্তি</th><th>ধরন</th><th className="text-right">পরিমাণ</th><th>স্ট্যাটাস</th>
                  </tr>
                </thead>
                <tbody>
                  {debts.map(d => (
                    <tr key={d.id} className="border-b last:border-0" style={{ borderColor: "var(--brand-line)" }}>
                      <td className="py-1.5">{d.person}</td>
                      <td className="py-1.5">{d.kind === "receivable" ? "পাওনা" : "দেনা"}</td>
                      <td className="py-1.5 text-right font-medium">{fmtTk(Number(d.amount))}</td>
                      <td className="py-1.5">
                        <span className={`px-1.5 py-0.5 rounded ${d.settled ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {d.settled ? "শোধ" : "বকেয়া"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="বাজেট" icon={<PiggyBank className="w-4 h-4" />} count={budgets.length}>
          {budgets.length === 0 ? <Empty text="কোনো বাজেট নেই" /> : (
            <div className="space-y-1.5">
              {budgets.map(b => (
                <div key={b.id} className="flex justify-between text-xs p-2 rounded-lg border" style={{ borderColor: "var(--brand-line)" }}>
                  <span className="font-medium">{b.label || b.category}</span>
                  <span className="text-slate-600">{fmtTk(Number(b.monthly_limit))}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="পরিকল্পনা" icon={<ListTodo className="w-4 h-4" />} count={tasks.length}>
          {tasks.length === 0 ? <Empty text="কোনো পরিকল্পনা নেই" /> : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {tasks.map(t => (
                <div key={t.id} className="flex items-start gap-2 p-2 rounded-lg border text-xs" style={{ borderColor: "var(--brand-line)" }}>
                  <span className={`w-2 h-2 rounded-full mt-1.5 ${t.done ? "bg-emerald-500" : "bg-slate-300"}`} />
                  <div className="flex-1">
                    <div className={t.done ? "line-through text-slate-400" : ""}>{t.task}</div>
                    <div className="text-[10px] text-slate-400 flex gap-2">
                      {t.due_text && <span>{t.due_text}</span>}
                      {t.amount_text && <span>৳ {t.amount_text}</span>}
                      <span>· {t.priority}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="নোট" icon={<StickyNote className="w-4 h-4" />} count={notes.length}>
          {notes.length === 0 ? <Empty text="কোনো নোট নেই" /> : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {notes.map(n => (
                <div key={n.id} className="p-2 rounded-lg border text-xs" style={{ borderColor: "var(--brand-line)" }}>
                  <div className="whitespace-pre-wrap">{n.body}</div>
                  <div className="text-[10px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString("bn-BD")}</div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {detail && (
        <DetailDialog
          title={detail.title}
          onClose={() => setDetail(null)}
          txns={txns}
          debts={debts}
          filterKey={detail.key}
        />
      )}
    </div>
  );
}

function Section({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  return (
    <div className="brand-card p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold flex items-center gap-2 text-sm" style={{ fontFamily: "var(--font-display)" }}>
          <span style={{ color: "var(--brand-emerald-700)" }}>{icon}</span>
          {title}
        </h3>
        <span className="text-xs text-slate-500">{count}</span>
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-6 text-center text-xs text-slate-400">{text}</div>;
}

function DetailDialog({ title, onClose, txns, debts, filterKey }: { title: string; onClose: () => void; txns: Txn[]; debts: Debt[]; filterKey: string }) {
  const { startISO, endISO } = monthBounds(new Date());
  let rows: Array<{ a: string; b: string; c: string }> = [];
  let cols = ["তারিখ", "ক্যাটাগরি", "পরিমাণ"];
  if (filterKey === "income") {
    rows = txns.filter(t => t.type === "income" && t.occurred_on >= startISO && t.occurred_on < endISO)
      .map(t => ({ a: new Date(t.occurred_on).toLocaleDateString("bn-BD"), b: t.category, c: fmtTk(Number(t.amount)) }));
  } else if (filterKey === "expense") {
    rows = txns.filter(t => t.type === "expense" && t.occurred_on >= startISO && t.occurred_on < endISO)
      .map(t => ({ a: new Date(t.occurred_on).toLocaleDateString("bn-BD"), b: t.category, c: fmtTk(Number(t.amount)) }));
  } else if (filterKey === "savings") {
    rows = txns.filter(t => t.occurred_on >= startISO && t.occurred_on < endISO)
      .map(t => ({ a: new Date(t.occurred_on).toLocaleDateString("bn-BD"), b: `${t.type === "income" ? "আয়" : "ব্যয়"} · ${t.category}`, c: (t.type === "income" ? "+" : "−") + " " + fmtTk(Number(t.amount)) }));
  } else if (filterKey === "receivable") {
    cols = ["ব্যক্তি", "নোট", "পরিমাণ"];
    rows = debts.filter(d => !d.settled && d.kind === "receivable")
      .map(d => ({ a: d.person, b: d.note || "—", c: fmtTk(Number(d.amount)) }));
  } else if (filterKey === "payable") {
    cols = ["ব্যক্তি", "নোট", "পরিমাণ"];
    rows = debts.filter(d => !d.settled && d.kind === "payable")
      .map(d => ({ a: d.person, b: d.note || "—", c: fmtTk(Number(d.amount)) }));
  } else {
    cols = ["তারিখ", "ধরন · ক্যাটাগরি", "পরিমাণ"];
    rows = txns.map(t => ({ a: new Date(t.occurred_on).toLocaleDateString("bn-BD"), b: `${t.type === "income" ? "আয়" : "ব্যয়"} · ${t.category}`, c: (t.type === "income" ? "+" : "−") + " " + fmtTk(Number(t.amount)) }));
  }
  const total = rows.length;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--brand-line)" }}>
          <h3 className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>{title} <span className="text-xs text-slate-400 font-normal">({total})</span></h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-auto p-5">
          {rows.length === 0 ? <Empty text="কোনো রেকর্ড নেই" /> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b" style={{ borderColor: "var(--brand-line)" }}>
                  {cols.map(c => <th key={c} className={`py-2 ${c === "পরিমাণ" ? "text-right" : ""}`}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0" style={{ borderColor: "var(--brand-line)" }}>
                    <td className="py-2 text-slate-500">{r.a}</td>
                    <td className="py-2">{r.b}</td>
                    <td className="py-2 text-right font-medium">{r.c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}