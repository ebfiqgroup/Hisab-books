import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { Shield, ShieldCheck, ShieldOff, Users, Wallet, TrendingDown, RefreshCw, Database, Trash2, UserCog, Clock, CheckCircle2, Ban, LayoutDashboard, Crown, UserCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserDataManager } from "@/components/admin/UserDataManager";
import { UserProfileEditor } from "@/components/admin/UserProfileEditor";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type Row = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  ref_code: string | null;
  created_at: string;
  status: "pending" | "approved" | "suspended";
  total_income: number;
  total_expense: number;
  tx_count: number;
  is_admin: boolean;
};

function AdminPage() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [manage, setManage] = useState<Row | null>(null);
  const [editProfile, setEditProfile] = useState<Row | null>(null);
  const [deleteUser, setDeleteUser] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusBusy, setStatusBusy] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "suspended">("all");
  const [anyAdmin, setAnyAdmin] = useState<boolean | null>(null);
  const [myRoles, setMyRoles] = useState<string[]>([]);

  // Check if any admin exists in the system + load current user's roles
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ count }, { data: roles }] = await Promise.all([
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).in("role", ["admin", "super_admin"]),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      setAnyAdmin((count ?? 0) > 0);
      setMyRoles((roles || []).map((r: any) => r.role));
    })();
  }, [user?.id, isAdmin]);

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

  // Redirect non-admins when an admin already exists in the system.
  // If no admin exists, keep them here so they can use the "claim" flow.
  useEffect(() => {
    if (isAdmin === false && anyAdmin === true) {
      toast.error("অ্যাডমিন প্যানেলে অ্যাক্সেস নেই", {
        description: "অ্যাডমিন অনুমতির জন্য সুপার অ্যাডমিনের কাছে রিকোয়েস্ট পাঠান।",
      });
      navigate({ to: "/super-admin", replace: true });
    }
  }, [isAdmin, anyAdmin, navigate]);

  if (isAdmin === null) return <AppShell title="অ্যাডমিন"><div className="p-8 text-slate-500">লোড হচ্ছে…</div></AppShell>;

  if (!isAdmin) {
    const isSuper = myRoles.includes("super_admin");
    const roleLabel = isSuper ? "সুপার অ্যাডমিন" : myRoles.includes("admin") ? "অ্যাডমিন" : "সাধারণ ব্যবহারকারী";
    const roleIcon = isSuper ? <Crown className="w-4 h-4" /> : myRoles.includes("admin") ? <ShieldCheck className="w-4 h-4" /> : <UserCircle2 className="w-4 h-4" />;
    const roleClass = isSuper
      ? "bg-amber-100 text-amber-800 border-amber-300"
      : myRoles.includes("admin")
      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
      : "bg-slate-100 text-slate-700 border-slate-300";
    return (
      <AppShell title="অ্যাডমিন">
        <div className="max-w-2xl mx-auto mt-6 space-y-5">
          {/* Current role status card */}
          <div className="brand-card p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ background: "var(--gradient-brand)" }}>
                  {(user?.email || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs text-slate-500">আপনার বর্তমান স্ট্যাটাস</div>
                  <div className="font-medium text-sm">{user?.email}</div>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${roleClass}`}>
                {roleIcon} {roleLabel}
              </span>
            </div>
          </div>

          {/* Access denied + claim card */}
          <div className="brand-card p-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4" style={{ background: "color-mix(in oklab, var(--brand-gold-500) 15%, transparent)", border: "1px solid color-mix(in oklab, var(--brand-gold-500) 30%, transparent)" }}>
              <Shield className="w-8 h-8" style={{ color: "var(--brand-emerald-700)" }} />
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: "var(--font-display)" }}>অ্যাডমিন প্যানেলে অ্যাক্সেস নেই</h2>
            <p className="text-sm text-slate-600 mb-6">
              এই পেজটি দেখতে <strong>অ্যাডমিন</strong> অনুমতি প্রয়োজন।
            </p>

            {anyAdmin === null ? (
              <div className="text-xs text-slate-400">চেক করা হচ্ছে…</div>
            ) : !anyAdmin ? (
              <div className="space-y-4">
                <div className="rounded-lg p-4 text-left" style={{ background: "color-mix(in oklab, var(--brand-gold-500) 10%, transparent)", border: "1px solid color-mix(in oklab, var(--brand-gold-500) 30%, transparent)" }}>
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--brand-gold-500)" }} />
                    <div className="text-xs text-slate-700">
                      <strong>সুসংবাদ!</strong> এখনো কেউ অ্যাডমিন হয়নি। আপনি এখনই নিজেকে প্রথম অ্যাডমিন + সুপার অ্যাডমিন হিসেবে যুক্ত করতে পারেন।
                    </div>
                  </div>
                </div>
                <button
                  disabled={claiming}
                  onClick={async () => {
                    setClaiming(true);
                    const { data, error } = await supabase.rpc("claim_admin_if_none");
                    setClaiming(false);
                    if (error) { toast.error(error.message); return; }
                    if (data === true) {
                      toast.success("অভিনন্দন! আপনি এখন অ্যাডমিন ও সুপার অ্যাডমিন!");
                      const { notifyRolesChanged } = await import("@/hooks/useRole");
                      notifyRolesChanged();
                    } else {
                      toast.error("ইতিমধ্যে অ্যাডমিন বিদ্যমান।");
                      setAnyAdmin(true);
                    }
                  }}
                  className="w-full px-6 py-3.5 rounded-xl text-white font-semibold text-base disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-shadow"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  <Crown className="w-5 h-5" />
                  {claiming ? "অনুরোধ পাঠানো হচ্ছে…" : "আমাকে অ্যাডমিন বানাও"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-slate-500">
                  ইতিমধ্যে একজন অ্যাডমিন বিদ্যমান। অ্যাডমিন অনুমতির জন্য সুপার অ্যাডমিনের কাছে রিকোয়েস্ট পাঠান।
                </div>
                <Link
                  to="/super-admin"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-white font-medium"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  <Crown className="w-4 h-4" /> রিকোয়েস্ট পাঠান
                </Link>
              </div>
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  const filtered = rows.filter(r =>
    (statusFilter === "all" || r.status === statusFilter) &&
    (!q.trim() ||
    (r.full_name || "").toLowerCase().includes(q.toLowerCase()) ||
    (r.ref_code || "").toLowerCase().includes(q.toLowerCase()) ||
    r.user_id.includes(q))
  );

  const totals = rows.reduce((a, r) => ({
    users: a.users + 1,
    income: a.income + Number(r.total_income || 0),
    expense: a.expense + Number(r.total_expense || 0),
    tx: a.tx + Number(r.tx_count || 0),
  }), { users: 0, income: 0, expense: 0, tx: 0 });

  const confirmToggle = async () => {
    if (!pending) return;
    const row = pending;
    setBusy(true);
    const t = toast.loading(row.is_admin ? "অ্যাডমিন সরানো হচ্ছে…" : "অ্যাডমিন যোগ করা হচ্ছে…");
    try {
      if (row.is_admin) {
        const { error } = await supabase.from("user_roles")
          .delete().eq("user_id", row.user_id).eq("role", "admin");
        if (error) throw error;
        toast.success("অ্যাডমিন সরানো হয়েছে", { id: t });
      } else {
        const { error } = await supabase.from("user_roles")
          .insert({ user_id: row.user_id, role: "admin" });
        if (error) throw error;
        toast.success("অ্যাডমিন যোগ করা হয়েছে", { id: t });
      }
      setPending(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "অপারেশন ব্যর্থ হয়েছে", { id: t });
    } finally {
      setBusy(false);
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat("bn-BD").format(Math.round(n || 0));

  const setStatus = async (row: Row, status: "pending" | "approved" | "suspended") => {
    setStatusBusy(row.user_id);
    const t = toast.loading("আপডেট হচ্ছে…");
    try {
      const { error } = await supabase.rpc("admin_set_user_status", { _user_id: row.user_id, _status: status });
      if (error) throw error;
      toast.success(
        status === "approved" ? "অনুমোদিত" : status === "suspended" ? "সাসপেন্ড" : "পেন্ডিং",
        { id: t }
      );
      await load();
    } catch (e: any) {
      toast.error(e?.message || "ব্যর্থ", { id: t });
    } finally {
      setStatusBusy(null);
    }
  };

  const statusCounts = rows.reduce((a, r) => {
    a[r.status] = (a[r.status] || 0) + 1;
    return a;
  }, {} as Record<string, number>);

  const confirmDeleteUser = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    const t = toast.loading("অ্যাকাউন্ট মুছে ফেলা হচ্ছে…");
    try {
      const { error } = await supabase.rpc("admin_delete_user", { _user_id: deleteUser.user_id });
      if (error) throw error;
      toast.success("অ্যাকাউন্ট সম্পূর্ণ মুছে ফেলা হয়েছে", { id: t });
      setDeleteUser(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "মুছে ফেলা ব্যর্থ", { id: t });
    } finally {
      setDeleting(false);
    }
  };

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
          <div className="flex items-center gap-2 flex-wrap">
            {(["all", "pending", "approved", "suspended"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-2.5 py-1.5 rounded-md border ${statusFilter === s ? "bg-slate-900 text-white border-slate-900" : "bg-white"}`}
                style={statusFilter !== s ? { borderColor: "var(--brand-line)" } : undefined}
              >
                {s === "all" ? "সব" : s === "pending" ? "পেন্ডিং" : s === "approved" ? "অনুমোদিত" : "সাসপেন্ডেড"}
                {s !== "all" && statusCounts[s] ? ` (${statusCounts[s]})` : ""}
              </button>
            ))}
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="নাম, রেফারেন্স বা আইডি…"
              className="px-3 py-2 rounded-lg border text-sm w-full md:w-56"
              style={{ borderColor: "var(--brand-line)" }}
            />
          </div>
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
                  <th className="py-2 pr-3">রেফারেন্স</th>
                  <th className="py-2 pr-3">যোগদান</th>
                  <th className="py-2 pr-3">স্ট্যাটাস</th>
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
                    <td className="py-3 pr-3">
                      {r.ref_code ? (
                        <button
                          onClick={() => { navigator.clipboard.writeText(r.ref_code!); toast.success("কোড কপি হয়েছে"); }}
                          className="font-mono text-xs px-2 py-1 rounded border bg-slate-50 hover:bg-slate-100"
                          title="কপি করুন"
                        >
                          {r.ref_code}
                        </button>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-3 pr-3 text-slate-600">{new Date(r.created_at).toLocaleDateString("bn-BD")}</td>
                    <td className="py-3 pr-3">
                      <StatusBadge status={r.status} />
                    </td>
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
                      <div className="flex gap-1.5 justify-end flex-wrap">
                        {r.status !== "approved" && (
                          <button
                            onClick={() => setStatus(r, "approved")}
                            disabled={statusBusy === r.user_id}
                            className="text-xs px-2.5 py-1.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 inline-flex items-center gap-1 disabled:opacity-50"
                            title="অনুমোদন"
                          >
                            <CheckCircle2 className="w-3 h-3" /> অনুমোদন
                          </button>
                        )}
                        {r.status !== "pending" && r.user_id !== user?.id && (
                          <button
                            onClick={() => setStatus(r, "pending")}
                            disabled={statusBusy === r.user_id}
                            className="text-xs px-2.5 py-1.5 rounded-md border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 inline-flex items-center gap-1 disabled:opacity-50"
                            title="পেন্ডিং"
                          >
                            <Clock className="w-3 h-3" /> পেন্ডিং
                          </button>
                        )}
                        {r.status !== "suspended" && r.user_id !== user?.id && (
                          <button
                            onClick={() => setStatus(r, "suspended")}
                            disabled={statusBusy === r.user_id}
                            className="text-xs px-2.5 py-1.5 rounded-md border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 inline-flex items-center gap-1 disabled:opacity-50"
                            title="সাসপেন্ড"
                          >
                            <Ban className="w-3 h-3" /> সাসপেন্ড
                          </button>
                        )}
                        <button
                          onClick={() => setManage(r)}
                          className="text-xs px-2.5 py-1.5 rounded-md border hover:shadow-sm inline-flex items-center gap-1 bg-white"
                          style={{ borderColor: "var(--brand-line)" }}
                          title="তথ্য ব্যবস্থাপনা"
                        >
                          <Database className="w-3 h-3" /> ডাটা
                        </button>
                        <Link
                          to="/admin/user/$userId"
                          params={{ userId: r.user_id }}
                          className="text-xs px-2.5 py-1.5 rounded-md border hover:shadow-sm inline-flex items-center gap-1 bg-white"
                          style={{ borderColor: "var(--brand-line)" }}
                          title="ফুল ড্যাশবোর্ড ভিউ"
                        >
                          <LayoutDashboard className="w-3 h-3" /> ড্যাশবোর্ড
                        </Link>
                        <button
                          onClick={() => setEditProfile(r)}
                          className="text-xs px-2.5 py-1.5 rounded-md border hover:shadow-sm inline-flex items-center gap-1 bg-white"
                          style={{ borderColor: "var(--brand-line)" }}
                          title="প্রোফাইল সেটিংস"
                        >
                          <UserCog className="w-3 h-3" /> প্রোফাইল
                        </button>
                        <button
                          onClick={() => setPending(r)}
                          className="text-xs px-2.5 py-1.5 rounded-md border hover:shadow-sm inline-flex items-center gap-1 bg-white"
                          style={{ borderColor: "var(--brand-line)" }}
                        >
                          {r.is_admin ? <><ShieldOff className="w-3 h-3" /> সরান</> : <><Shield className="w-3 h-3" /> অ্যাডমিন</>}
                        </button>
                        {r.user_id !== user?.id && (
                          <button
                            onClick={() => setDeleteUser(r)}
                            className="text-xs px-2.5 py-1.5 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50 inline-flex items-center gap-1"
                            title="অ্যাকাউন্ট মুছুন"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => { if (!o && !busy) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.is_admin ? "অ্যাডমিন অনুমতি সরাবেন?" : "অ্যাডমিন বানাবেন?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-semibold text-foreground">{pending?.full_name || "—"}</span>
                  {" "}<span className="text-xs text-slate-400 font-mono">({pending?.user_id.slice(0, 8)}…)</span>
                </p>
                {pending?.is_admin ? (
                  <p className="text-rose-600">
                    এই ব্যবহারকারী আর সব ব্যবহারকারীর তথ্য দেখতে বা পরিবর্তন করতে পারবেন না।
                  </p>
                ) : (
                  <p className="text-amber-700">
                    এই ব্যবহারকারী সব ব্যবহারকারীর তথ্য দেখতে এবং অন্যদের অ্যাডমিন বানাতে/সরাতে পারবেন।
                  </p>
                )}
                {pending?.user_id === user?.id && pending?.is_admin && (
                  <p className="text-rose-700 font-medium">
                    ⚠️ এটি আপনার নিজের অ্যাকাউন্ট — সরালে এই পেজে আর প্রবেশ করতে পারবেন না।
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>বাতিল</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => { e.preventDefault(); confirmToggle(); }}
              className={pending?.is_admin ? "bg-rose-600 hover:bg-rose-700" : ""}
            >
              {busy ? "অপেক্ষা করুন…" : (pending?.is_admin ? "হ্যাঁ, সরান" : "হ্যাঁ, অ্যাডমিন বানান")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteUser} onOpenChange={(o) => { if (!o && !deleting) setDeleteUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-600">⚠️ অ্যাকাউন্ট সম্পূর্ণ মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-semibold text-foreground">{deleteUser?.full_name || "—"}</span>
                  {" "}<span className="text-xs text-slate-400 font-mono">({deleteUser?.user_id.slice(0, 8)}…)</span>
                </p>
                <p className="text-rose-700 font-medium">
                  এই ব্যবহারকারীর সকল লেনদেন, বাজেট, ঋণ, লক্ষ্য, নোট, টাস্ক এবং অ্যাকাউন্ট স্থায়ীভাবে মুছে যাবে। এটি আর পুনরুদ্ধার করা যাবে না।
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>বাতিল</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); confirmDeleteUser(); }}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {deleting ? "মুছে ফেলা হচ্ছে…" : "হ্যাঁ, সম্পূর্ণ মুছুন"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {manage && (
        <UserDataManager
          userId={manage.user_id}
          userName={manage.full_name || ""}
          open={!!manage}
          onOpenChange={(o) => { if (!o) setManage(null); }}
        />
      )}

      {editProfile && (
        <UserProfileEditor
          userId={editProfile.user_id}
          open={!!editProfile}
          onOpenChange={(o) => { if (!o) setEditProfile(null); }}
          onSaved={() => { load(); }}
        />
      )}
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

function StatusBadge({ status }: { status: "pending" | "approved" | "suspended" }) {
  const map = {
    pending: { label: "পেন্ডিং", icon: <Clock className="w-3 h-3" />, cls: "bg-amber-50 text-amber-700 border-amber-200" },
    approved: { label: "অনুমোদিত", icon: <CheckCircle2 className="w-3 h-3" />, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    suspended: { label: "সাসপেন্ডেড", icon: <Ban className="w-3 h-3" />, cls: "bg-rose-50 text-rose-700 border-rose-200" },
  };
  const m = map[status] || map.approved;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${m.cls}`}>
      {m.icon} {m.label}
    </span>
  );
}