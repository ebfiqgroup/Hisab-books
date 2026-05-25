import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useRole";
import { fmtTk, categoryColor, monthBounds } from "@/lib/finance";
import { Shield, Search, RefreshCw, Wallet, ArrowDown, PiggyBank, Users as UsersIcon, ExternalLink, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/dashboards")({
  component: AllDashboardsPage,
});

type Overview = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  ref_code: string | null;
  created_at: string;
  status: "pending" | "approved" | "suspended";
  total_income: number;
  total_expense: number;
  tx_count: number;
};

type Txn = { user_id: string; type: "income" | "expense"; category: string; amount: number; occurred_on: string };
type Debt = { user_id: string; kind: "receivable" | "payable"; amount: number; settled: boolean };

function AllDashboardsPage() {
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Overview[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const [u, t, d] = await Promise.all([
      supabase.from("admin_user_overview").select("*").order("created_at", { ascending: false }),
      supabase.from("transactions").select("user_id,type,category,amount,occurred_on"),
      supabase.from("debts").select("user_id,kind,amount,settled"),
    ]);
    if (u.error) toast.error(u.error.message);
    if (t.error) toast.error(t.error.message);
    if (d.error) toast.error(d.error.message);
    setUsers((u.data as Overview[]) || []);
    setTxns((t.data as Txn[]) || []);
    setDebts((d.data as Debt[]) || []);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const { startISO, endISO } = useMemo(() => monthBounds(new Date()), []);

  const byUser = useMemo(() => {
    const map = new Map<string, { mInc: number; mExp: number; topExp: { label: string; amount: number; color: string }[]; recv: number; pay: number }>();
    for (const u of users) map.set(u.user_id, { mInc: 0, mExp: 0, topExp: [], recv: 0, pay: 0 });
    const catMap = new Map<string, Map<string, number>>();
    for (const t of txns) {
      const cur = map.get(t.user_id);
      if (!cur) continue;
      if (t.occurred_on >= startISO && t.occurred_on < endISO) {
        if (t.type === "income") cur.mInc += Number(t.amount);
        else cur.mExp += Number(t.amount);
      }
      if (t.type === "expense") {
        let cm = catMap.get(t.user_id);
        if (!cm) { cm = new Map(); catMap.set(t.user_id, cm); }
        cm.set(t.category, (cm.get(t.category) ?? 0) + Number(t.amount));
      }
    }
    for (const [uid, cm] of catMap) {
      const arr = Array.from(cm.entries())
        .map(([label, amount]) => ({ label, amount, color: categoryColor(label) }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 4);
      const cur = map.get(uid);
      if (cur) cur.topExp = arr;
    }
    for (const d of debts) {
      if (d.settled) continue;
      const cur = map.get(d.user_id);
      if (!cur) continue;
      if (d.kind === "receivable") cur.recv += Number(d.amount);
      else cur.pay += Number(d.amount);
    }
    return map;
  }, [users, txns, debts, startISO, endISO]);

  const filtered = users.filter((u) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (u.full_name || "").toLowerCase().includes(s) || (u.ref_code || "").toLowerCase().includes(s) || u.user_id.includes(q);
  });

  if (isAdmin === null) return <AppShell title="সব ড্যাশবোর্ড"><div className="p-8 text-slate-500">লোড হচ্ছে…</div></AppShell>;
  if (!isAdmin) {
    return (
      <AppShell title="সব ড্যাশবোর্ড">
        <div className="max-w-xl mx-auto mt-10 brand-card p-8 text-center">
          <Shield className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--brand-emerald-700)" }} />
          <h2 className="text-lg font-semibold mb-2">অ্যাক্সেস নেই</h2>
          <p className="text-sm text-slate-600">এই পেজটি দেখতে অ্যাডমিন অনুমতি প্রয়োজন।</p>
        </div>
      </AppShell>
    );
  }

  const totals = filtered.reduce((a, u) => {
    const b = byUser.get(u.user_id);
    return {
      users: a.users + 1,
      mInc: a.mInc + (b?.mInc || 0),
      mExp: a.mExp + (b?.mExp || 0),
      recv: a.recv + (b?.recv || 0),
    };
  }, { users: 0, mInc: 0, mExp: 0, recv: 0 });

  return (
    <AppShell
      title="সব ইউজারের ড্যাশবোর্ড"
      actions={
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border text-sm hover:shadow-sm" style={{ borderColor: "var(--brand-line)" }}>
          <RefreshCw className="w-4 h-4" /> রিফ্রেশ
        </button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <SummaryCard icon={<UsersIcon className="w-5 h-5" />} label="ইউজার" value={String(totals.users)} tone="indigo" />
        <SummaryCard icon={<Wallet className="w-5 h-5" />} label="এ মাসে আয়" value={fmtTk(totals.mInc)} tone="emerald" />
        <SummaryCard icon={<ArrowDown className="w-5 h-5" />} label="এ মাসে ব্যয়" value={fmtTk(totals.mExp)} tone="rose" />
        <SummaryCard icon={<PiggyBank className="w-5 h-5" />} label="মোট পাওনা" value={fmtTk(totals.recv)} tone="amber" />
      </div>

      <div className="brand-card p-3 md:p-4 mb-5">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="নাম, রেফারেন্স বা আইডি দিয়ে খুঁজুন…"
            className="flex-1 px-2 py-1.5 text-sm bg-transparent outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-500">লোড হচ্ছে…</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-slate-500">কোনো ইউজার পাওয়া যায়নি</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((u) => {
            const b = byUser.get(u.user_id) || { mInc: 0, mExp: 0, topExp: [], recv: 0, pay: 0 };
            const rem = b.mInc - b.mExp;
            const statusBadge =
              u.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
              u.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200" :
              "bg-rose-50 text-rose-700 border-rose-200";
            const statusLabel = u.status === "approved" ? "অনুমোদিত" : u.status === "pending" ? "পেন্ডিং" : "সাসপেন্ড";
            return (
              <div key={u.user_id} className="brand-card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: "var(--gradient-brand)" }}>
                      {(u.full_name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{u.full_name || "—"}</div>
                      <div className="text-[11px] text-slate-400 font-mono truncate">
                        {u.ref_code ? `${u.ref_code} · ` : ""}{u.user_id.slice(0, 8)}…
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusBadge}`}>{statusLabel}</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <MiniStat label="আয়" value={fmtTk(b.mInc)} cls="text-emerald-600" />
                  <MiniStat label="ব্যয়" value={fmtTk(b.mExp)} cls="text-rose-500" />
                  <MiniStat label="অবশিষ্ট" value={fmtTk(rem)} cls={rem >= 0 ? "text-blue-600" : "text-rose-600"} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-slate-200 px-2.5 py-2">
                    <div className="text-slate-500">পাওনা</div>
                    <div className="font-semibold text-emerald-600">{fmtTk(b.recv)}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 px-2.5 py-2">
                    <div className="text-slate-500">দেনা</div>
                    <div className="font-semibold text-rose-500">{fmtTk(b.pay)}</div>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-500 mb-1.5">শীর্ষ ব্যয় (সর্বমোট)</div>
                  {b.topExp.length === 0 ? (
                    <div className="text-xs text-slate-400">কোনো ব্যয় নেই</div>
                  ) : (
                    <div className="space-y-1.5">
                      {b.topExp.map((c) => {
                        const max = b.topExp[0].amount || 1;
                        const pct = Math.max(4, Math.round((c.amount / max) * 100));
                        return (
                          <div key={c.label} className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                            <span className="text-[11px] text-slate-600 truncate flex-1">{c.label}</span>
                            <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full" style={{ width: `${pct}%`, background: c.color }} />
                            </div>
                            <span className="text-[11px] font-mono text-slate-700 w-16 text-right">{fmtTk(c.amount)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100 mt-auto">
                  <div className="text-[11px] text-slate-400">মোট লেনদেন: {u.tx_count}</div>
                  <Link
                    to="/admin/user/$userId"
                    params={{ userId: u.user_id }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> ফুল ড্যাশবোর্ড
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "indigo" | "emerald" | "rose" | "amber" }) {
  const toneCls = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-500",
    amber: "bg-amber-50 text-amber-600",
  }[tone];
  return (
    <div className="brand-card p-3 md:p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${toneCls}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] text-slate-500">{label}</div>
        <div className="text-base md:text-lg font-bold truncate">{value}</div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2.5 py-2">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className={`text-sm font-bold ${cls}`}>{value}</div>
    </div>
  );
}