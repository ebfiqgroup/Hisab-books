import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { Shield, ShieldCheck, ShieldOff, Users, Wallet, TrendingDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type Row = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  total_income: number;
  total_expense: number;
  tx_count: number;
  is_admin: boolean;
};

function AdminPage() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_user_overview")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as Row[]) || []);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (isAdmin === null) return <AppShell title="অ্যাডমিন"><div className="p-8 text-slate-500">লোড হচ্ছে…</div></AppShell>;

  if (!isAdmin) {
    return (
      <AppShell title="অ্যাডমিন">
        <div className="max-w-xl mx-auto mt-10 brand-card p-8 text-center">
          <Shield className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--brand-emerald-700)" }} />
          <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: "var(--font-display)" }}>অ্যাক্সেস নেই</h2>
          <p className="text-sm text-slate-600 mb-5">এই পেজটি দেখতে অ্যাডমিন অনুমতি লাগবে।</p>
          <p className="text-xs text-slate-500 mb-4">
            যদি এখনো কেউ অ্যাডমিন না হয়ে থাকে, আপনি প্রথম অ্যাডমিন হিসেবে নিজেকে যুক্ত করতে পারেন।
          </p>
          <button
            disabled={claiming}
            onClick={async () => {
              setClaiming(true);
              const { data, error } = await supabase.rpc("claim_admin_if_none");
              setClaiming(false);
              if (error) { toast.error(error.message); return; }
              if (data === true) { toast.success("আপনি এখন অ্যাডমিন!"); window.location.reload(); }
              else toast.error("ইতিমধ্যে অ্যাডমিন বিদ্যমান।");
            }}
            className="px-5 py-2.5 rounded-lg text-white font-medium disabled:opacity-50"
            style={{ background: "var(--gradient-brand)" }}
          >
            {claiming ? "অনুরোধ পাঠানো হচ্ছে…" : "আমাকে অ্যাডমিন বানাও"}
          </button>
        </div>
      </AppShell>
    );
  }

  const filtered = rows.filter(r =>
    !q.trim() ||
    (r.full_name || "").toLowerCase().includes(q.toLowerCase()) ||
    r.user_id.includes(q)
  );

  const totals = rows.reduce((a, r) => ({
    users: a.users + 1,
    income: a.income + Number(r.total_income || 0),
    expense: a.expense + Number(r.total_expense || 0),
    tx: a.tx + Number(r.tx_count || 0),
  }), { users: 0, income: 0, expense: 0, tx: 0 });

  const toggleAdmin = async (row: Row) => {
    if (row.user_id === user?.id && row.is_admin) {
      if (!confirm("নিজের অ্যাডমিন অনুমতি সরাবেন?")) return;
    }
    if (row.is_admin) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", row.user_id).eq("role", "admin");
      if (error) return toast.error(error.message);
      toast.success("অ্যাডমিন সরানো হয়েছে");
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: row.user_id, role: "admin" });
      if (error) return toast.error(error.message);
      toast.success("অ্যাডমিন বানানো হয়েছে");
    }
    load();
  };

  const fmt = (n: number) => new Intl.NumberFormat("bn-BD").format(Math.round(n || 0));

  return (
    <AppShell
      title="অ্যাডমিন প্যানেল"
      actions={
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border text-sm hover:shadow-sm" style={{ borderColor: "var(--brand-line)" }}>
          <RefreshCw className="w-4 h-4" /> রিফ্রেশ
        </button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Users className="w-5 h-5" />} label="মোট ব্যবহারকারী" value={fmt(totals.users)} />
        <StatCard icon={<Wallet className="w-5 h-5" />} label="মোট আয়" value={`৳ ${fmt(totals.income)}`} />
        <StatCard icon={<TrendingDown className="w-5 h-5" />} label="মোট ব্যয়" value={`৳ ${fmt(totals.expense)}`} />
        <StatCard icon={<RefreshCw className="w-5 h-5" />} label="মোট লেনদেন" value={fmt(totals.tx)} />
      </div>

      <div className="brand-card p-4 md:p-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>ব্যবহারকারী তালিকা</h3>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="নাম বা ID দিয়ে খুঁজুন…"
            className="px-3 py-2 rounded-lg border text-sm w-full md:w-72"
            style={{ borderColor: "var(--brand-line)" }}
          />
        </div>

        {loading ? (
          <div className="py-10 text-center text-slate-500">লোড হচ্ছে…</div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-slate-500">কোনো ব্যবহারকারী পাওয়া যায়নি</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b" style={{ borderColor: "var(--brand-line)" }}>
                  <th className="py-2 pr-3">ব্যবহারকারী</th>
                  <th className="py-2 pr-3">যোগদান</th>
                  <th className="py-2 pr-3 text-right">আয়</th>
                  <th className="py-2 pr-3 text-right">ব্যয়</th>
                  <th className="py-2 pr-3 text-right">লেনদেন</th>
                  <th className="py-2 pr-3">রোল</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.user_id} className="border-b last:border-0 hover:bg-slate-50/60" style={{ borderColor: "var(--brand-line)" }}>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: "var(--gradient-brand)" }}>
                          {(r.full_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{r.full_name || "—"}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{r.user_id.slice(0, 8)}…</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-slate-600">{new Date(r.created_at).toLocaleDateString("bn-BD")}</td>
                    <td className="py-3 pr-3 text-right text-emerald-700">৳ {fmt(Number(r.total_income))}</td>
                    <td className="py-3 pr-3 text-right text-rose-600">৳ {fmt(Number(r.total_expense))}</td>
                    <td className="py-3 pr-3 text-right">{fmt(Number(r.tx_count))}</td>
                    <td className="py-3 pr-3">
                      {r.is_admin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "color-mix(in oklab, var(--brand-gold-500) 22%, transparent)", color: "var(--brand-emerald-900)" }}>
                          <ShieldCheck className="w-3 h-3" /> অ্যাডমিন
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">ব্যবহারকারী</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => toggleAdmin(r)}
                        className="text-xs px-3 py-1.5 rounded-md border hover:shadow-sm inline-flex items-center gap-1"
                        style={{ borderColor: "var(--brand-line)" }}
                      >
                        {r.is_admin ? <><ShieldOff className="w-3 h-3" /> সরান</> : <><Shield className="w-3 h-3" /> অ্যাডমিন করুন</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="brand-card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
        <div style={{ color: "var(--brand-emerald-700)" }}>{icon}</div>
      </div>
      <div className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--brand-ink)" }}>{value}</div>
    </div>
  );
}