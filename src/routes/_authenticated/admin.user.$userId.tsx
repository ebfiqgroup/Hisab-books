import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useRole";
import { fmtTk, monthBounds, BN_MONTHS } from "@/lib/finance";
import {
  ArrowLeft, Shield, Wallet, ArrowDown, PiggyBank, Users, TrendingDown,
  Target, StickyNote, ListTodo, ArrowLeftRight, RefreshCw, Mail, User as UserIcon,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/admin/user/$userId")({
  component: AdminUserView,
});

type Txn = { id: string; type: "income" | "expense"; category: string; amount: number; occurred_on: string; note: string | null };
type Debt = { id: string; kind: "receivable" | "payable"; amount: number; settled: boolean; person: string; due_date: string | null; note: string | null };
type Goal = { id: string; label: string; target: number; current: number; color: string; deadline: string | null };
type Note = { id: string; body: string; created_at: string };
type Task = { id: string; task: string; due_text: string | null; amount_text: string | null; priority: string; done: boolean };
type Budget = { id: string; category: string; monthly_limit: number; label: string | null };
type Profile = { id: string; full_name: string | null; avatar_url: string | null; status: string; created_at: string };

const BN_DAYS = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];

function AdminUserView() {
  const { userId } = Route.useParams();
  const isAdmin = useIsAdmin();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);

  const load = async () => {
    setLoading(true);
    const [p, t, d, g, n, k, b] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("transactions").select("id,type,category,amount,occurred_on,note").eq("user_id", userId).order("occurred_on", { ascending: false }).limit(1000),
      supabase.from("debts").select("id,kind,amount,settled,person,due_date,note").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("goals").select("id,label,target,current,color,deadline").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("notes").select("id,body,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      supabase.from("plan_tasks").select("id,task,due_text,amount_text,priority,done").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("budgets").select("id,category,monthly_limit,label").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    setProfile((p.data as Profile) || null);
    setTxns((t.data as Txn[]) || []);
    setDebts((d.data as Debt[]) || []);
    setGoals((g.data as Goal[]) || []);
    setNotes((n.data as Note[]) || []);
    setTasks((k.data as Task[]) || []);
    setBudgets((b.data as Budget[]) || []);
    // try to fetch email via admin RPC if available — fallback skip
    try {
      const { data: ad } = await supabase.rpc("admin_user_email" as any, { _user_id: userId });
      if (ad) setEmail(String(ad));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, userId]);

  const now = new Date();
  const chartSeries = useMemo(() => {
    const y = now.getFullYear();
    return BN_MONTHS.map((m, i) => {
      const mTxns = txns.filter(t => { const d = new Date(t.occurred_on); return d.getFullYear() === y && d.getMonth() === i; });
      const sumT = (arr: Txn[], type: "income" | "expense") => arr.filter(t => t.type === type).reduce((s, t) => s + Number(t.amount), 0);
      return { d: m.slice(0, 3), আয়: sumT(mTxns, "income"), ব্যয়: sumT(mTxns, "expense") };
    });
  }, [txns]);

  if (isAdmin === null) return <AppShell title="ইউজার ড্যাশবোর্ড"><div className="p-8 text-slate-500">লোড হচ্ছে…</div></AppShell>;
  if (!isAdmin) {
    return (
      <AppShell title="ইউজার ড্যাশবোর্ড">
        <div className="max-w-xl mx-auto mt-10 brand-card p-8 text-center">
          <Shield className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--brand-emerald-700)" }} />
          <h2 className="text-xl font-semibold mb-2">অ্যাক্সেস নেই</h2>
          <p className="text-sm text-slate-600">এই পেজটি দেখতে অ্যাডমিন অনুমতি লাগবে।</p>
        </div>
      </AppShell>
    );
  }

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
    { label: "এই মাসের আয়", value: fmtTk(curInc), last: `গত: ${fmtTk(prevInc)}`, Icon: Wallet, c: "emerald" },
    { label: "এই মাসের ব্যয়", value: fmtTk(curExp), last: `গত: ${fmtTk(prevExp)}`, Icon: ArrowDown, c: "rose" },
    { label: "এই মাসের সঞ্চয়", value: fmtTk(curInc - curExp), last: `গত: ${fmtTk(prevInc - prevExp)}`, Icon: PiggyBank, c: "blue" },
    { label: "মোট পাওনা", value: fmtTk(receivable), last: "", Icon: Users, c: "orange" },
    { label: "মোট দেনা", value: fmtTk(payable), last: "", Icon: TrendingDown, c: "rose" },
    { label: "সর্বমোট লেনদেন", value: String(txns.length), last: `আয় ${fmtTk(totalInc)} · ব্যয় ${fmtTk(totalExp)}`, Icon: ArrowLeftRight, c: "indigo" },
  ];

  const cBg: Record<string, string> = { emerald: "bg-emerald-50 text-emerald-600", rose: "bg-rose-50 text-rose-500", blue: "bg-blue-50 text-blue-600", orange: "bg-orange-50 text-orange-500", indigo: "bg-indigo-50 text-indigo-600" };

  return (
    <AppShell
      title="ইউজার ড্যাশবোর্ড"
      actions={
        <div className="flex gap-2">
          <Link to="/admin" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border text-sm hover:shadow-sm" style={{ borderColor: "var(--brand-line)" }}>
            <ArrowLeft className="w-4 h-4" /> ফিরে যান
          </Link>
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border text-sm hover:shadow-sm" style={{ borderColor: "var(--brand-line)" }}>
            <RefreshCw className="w-4 h-4" /> রিফ্রেশ
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="py-16 text-center text-slate-500">লোড হচ্ছে…</div>
      ) : !profile ? (
        <div className="py-16 text-center text-slate-500">ইউজার পাওয়া যায়নি</div>
      ) : (
        <div className="space-y-6">
          {/* Profile header */}
          <div className="brand-card p-5 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold overflow-hidden" style={{ background: "var(--gradient-brand)" }}>
              {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : (profile.full_name || "?").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{profile.full_name || "—"}</div>
              <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 flex-wrap">
                <span className="font-mono">{profile.id.slice(0, 12)}…</span>
                {email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {email}</span>}
                <span>যোগদান: {new Date(profile.created_at).toLocaleDateString("bn-BD")}</span>
                <span className={`px-2 py-0.5 rounded-full font-medium ${profile.status === "approved" ? "bg-emerald-100 text-emerald-700" : profile.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                  {profile.status === "approved" ? "অনুমোদিত" : profile.status === "pending" ? "পেন্ডিং" : "সাসপেন্ডেড"}
                </span>
              </div>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {cards.map(s => (
              <div key={s.label} className="bg-white rounded-xl p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${cBg[s.c]}`}><s.Icon className="w-4 h-4" /></div>
                  <div className="text-xs text-slate-500">{s.label}</div>
                </div>
                <div className="text-lg font-bold text-slate-800">{s.value}</div>
                {s.last && <div className="text-[11px] text-slate-400 mt-1">{s.last}</div>}
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="brand-card p-5">
            <h3 className="font-semibold mb-3" style={{ fontFamily: "var(--font-display)" }}>মাসিক আয়-ব্যয় ({now.getFullYear()})</h3>
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={chartSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="d" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="আয়" stroke="#10b981" fill="#10b98133" />
                  <Area type="monotone" dataKey="ব্যয়" stroke="#f43f5e" fill="#f43f5e33" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent Transactions */}
            <Section title="সাম্প্রতিক লেনদেন" icon={<ArrowLeftRight className="w-4 h-4" />} count={txns.length}>
              {txns.length === 0 ? <Empty text="কোনো লেনদেন নেই" /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 border-b" style={{ borderColor: "var(--brand-line)" }}>
                        <th className="py-2">তারিখ</th><th>ক্যাটাগরি</th><th className="text-right">পরিমাণ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txns.slice(0, 15).map(t => (
                        <tr key={t.id} className="border-b last:border-0" style={{ borderColor: "var(--brand-line)" }}>
                          <td className="py-2 text-slate-500">{new Date(t.occurred_on).toLocaleDateString("bn-BD")}</td>
                          <td className="py-2">{t.category}</td>
                          <td className={`py-2 text-right font-medium ${t.type === "income" ? "text-emerald-600" : "text-rose-500"}`}>
                            {t.type === "income" ? "+" : "−"} {fmtTk(Number(t.amount))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* Goals */}
            <Section title="লক্ষ্য" icon={<Target className="w-4 h-4" />} count={goals.length}>
              {goals.length === 0 ? <Empty text="কোনো লক্ষ্য নেই" /> : (
                <div className="space-y-3">
                  {goals.map(g => {
                    const pct = Math.min(100, Math.round((Number(g.current) / Math.max(1, Number(g.target))) * 100));
                    return (
                      <div key={g.id} className="p-3 rounded-lg border" style={{ borderColor: "var(--brand-line)" }}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{g.label}</span>
                          <span className="text-slate-500">{fmtTk(Number(g.current))} / {fmtTk(Number(g.target))}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* Debts */}
            <Section title="পাওনা / দেনা" icon={<Users className="w-4 h-4" />} count={debts.length}>
              {debts.length === 0 ? <Empty text="কোনো দেনা-পাওনা নেই" /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 border-b" style={{ borderColor: "var(--brand-line)" }}>
                        <th className="py-2">ব্যক্তি</th><th>ধরন</th><th className="text-right">পরিমাণ</th><th>স্ট্যাটাস</th>
                      </tr>
                    </thead>
                    <tbody>
                      {debts.map(d => (
                        <tr key={d.id} className="border-b last:border-0" style={{ borderColor: "var(--brand-line)" }}>
                          <td className="py-2">{d.person}</td>
                          <td className="py-2 text-xs">{d.kind === "receivable" ? "পাওনা" : "দেনা"}</td>
                          <td className="py-2 text-right font-medium">{fmtTk(Number(d.amount))}</td>
                          <td className="py-2 text-xs">
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

            {/* Budgets */}
            <Section title="বাজেট" icon={<PiggyBank className="w-4 h-4" />} count={budgets.length}>
              {budgets.length === 0 ? <Empty text="কোনো বাজেট নেই" /> : (
                <div className="space-y-2">
                  {budgets.map(b => (
                    <div key={b.id} className="flex justify-between text-sm p-2.5 rounded-lg border" style={{ borderColor: "var(--brand-line)" }}>
                      <span className="font-medium">{b.label || b.category}</span>
                      <span className="text-slate-600">{fmtTk(Number(b.monthly_limit))}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Tasks */}
            <Section title="পরিকল্পনা" icon={<ListTodo className="w-4 h-4" />} count={tasks.length}>
              {tasks.length === 0 ? <Empty text="কোনো পরিকল্পনা নেই" /> : (
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {tasks.map(t => (
                    <div key={t.id} className="flex items-start gap-2 p-2 rounded-lg border text-sm" style={{ borderColor: "var(--brand-line)" }}>
                      <span className={`w-2 h-2 rounded-full mt-1.5 ${t.done ? "bg-emerald-500" : "bg-slate-300"}`} />
                      <div className="flex-1">
                        <div className={t.done ? "line-through text-slate-400" : ""}>{t.task}</div>
                        <div className="text-[11px] text-slate-400 flex gap-2">
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

            {/* Notes */}
            <Section title="নোট" icon={<StickyNote className="w-4 h-4" />} count={notes.length}>
              {notes.length === 0 ? <Empty text="কোনো নোট নেই" /> : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {notes.map(n => (
                    <div key={n.id} className="p-2.5 rounded-lg border text-sm" style={{ borderColor: "var(--brand-line)" }}>
                      <div className="whitespace-pre-wrap">{n.body}</div>
                      <div className="text-[11px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString("bn-BD")}</div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Section({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  return (
    <div className="brand-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
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
  return <div className="py-6 text-center text-sm text-slate-400">{text}</div>;
}
