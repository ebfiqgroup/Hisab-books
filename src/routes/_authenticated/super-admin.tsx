import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { Crown, Shield, ShieldCheck, ShieldOff, Users, Activity, RefreshCw, Database, AlertTriangle, Send, Check, X, Clock, Inbox } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/super-admin")({
  component: SuperAdminPage,
});

type UserRow = {
  user_id: string;
  full_name: string | null;
  ref_code: string | null;
  created_at: string;
  status: string;
  is_admin: boolean;
  is_super_admin: boolean;
};

type Stats = {
  users: number;
  admins: number;
  superAdmins: number;
  pending: number;
  suspended: number;
  transactions: number;
  budgets: number;
  goals: number;
  tickets: number;
};

type RoleRequest = {
  id: string;
  user_id: string;
  requested_role: "admin" | "super_admin";
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  full_name?: string | null;
};

function SuperAdminPage() {
  const { user } = useAuth();
  const isSuper = useIsSuperAdmin();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<{ row: UserRow; action: "grant_admin" | "revoke_admin" | "grant_super" | "revoke_super" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState<RoleRequest[]>([]);

  const load = async () => {
    setLoading(true);
    const [overview, roles, txc, bdc, glc, tkc, reqs] = await Promise.all([
      supabase.from("admin_user_overview").select("user_id, full_name, ref_code, created_at, status").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("transactions").select("id", { count: "exact", head: true }),
      supabase.from("budgets").select("id", { count: "exact", head: true }),
      supabase.from("goals").select("id", { count: "exact", head: true }),
      supabase.from("support_tickets").select("id", { count: "exact", head: true }),
      supabase.from("role_requests").select("*").order("created_at", { ascending: false }),
    ]);
    if (overview.error) toast.error(overview.error.message);
    const roleMap = new Map<string, { admin: boolean; super: boolean }>();
    (roles.data || []).forEach((r: any) => {
      const cur = roleMap.get(r.user_id) || { admin: false, super: false };
      if (r.role === "admin") cur.admin = true;
      if (r.role === "super_admin") cur.super = true;
      roleMap.set(r.user_id, cur);
    });
    const merged: UserRow[] = (overview.data || []).map((u: any) => {
      const r = roleMap.get(u.user_id) || { admin: false, super: false };
      return { ...u, is_admin: r.admin, is_super_admin: r.super };
    });
    setRows(merged);
    let admins = 0, supers = 0, pendingC = 0, suspended = 0;
    merged.forEach(r => {
      if (r.is_admin) admins++;
      if (r.is_super_admin) supers++;
      if (r.status === "pending") pendingC++;
      if (r.status === "suspended") suspended++;
    });
    setStats({
      users: merged.length,
      admins, superAdmins: supers, pending: pendingC, suspended,
      transactions: txc.count || 0, budgets: bdc.count || 0, goals: glc.count || 0, tickets: tkc.count || 0,
    });
    const nameMap = new Map(merged.map(m => [m.user_id, m.full_name]));
    setRequests(((reqs.data as any[]) || []).map(r => ({ ...r, full_name: nameMap.get(r.user_id) || null })));
    setLoading(false);
  };

  useEffect(() => { if (isSuper) load(); }, [isSuper]);

  const filtered = useMemo(() => rows.filter(r =>
    !q.trim() ||
    (r.full_name || "").toLowerCase().includes(q.toLowerCase()) ||
    (r.ref_code || "").toLowerCase().includes(q.toLowerCase()) ||
    r.user_id.includes(q)
  ), [rows, q]);

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    const t = toast.loading("আপডেট হচ্ছে…");
    try {
      const { row, action } = pending;
      const fn = action.startsWith("grant") ? "admin_grant_role" : "admin_revoke_role";
      const role = action.endsWith("super") ? "super_admin" : "admin";
      const { error } = await supabase.rpc(fn, { _user_id: row.user_id, _role: role });
      if (error) throw error;
      toast.success("সম্পন্ন হয়েছে", { id: t });
      setPending(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "ব্যর্থ", { id: t });
    } finally { setBusy(false); }
  };

  if (isSuper === null) return <AppShell title="সুপার অ্যাডমিন"><div className="p-8 text-slate-500">লোড হচ্ছে…</div></AppShell>;

  if (!isSuper) {
    return <AccessDeniedWithRequest />;
  }

  const fmt = (n: number) => new Intl.NumberFormat("bn-BD").format(n || 0);

  return (
    <AppShell
      title="সুপার অ্যাডমিন"
      actions={
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border text-sm hover:shadow-sm" style={{ borderColor: "var(--brand-line)" }}>
          <RefreshCw className="w-4 h-4" /> রিফ্রেশ
        </button>
      }
    >
      <div className="brand-card p-5 mb-6 flex items-center gap-4" style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--brand-gold-500) 14%, transparent), transparent)" }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-brand)" }}>
          <Crown className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>সুপার অ্যাডমিন প্যানেল</h2>
          <p className="text-sm text-slate-600">রোল ম্যানেজমেন্ট এবং সিস্টেম-ব্যাপী নিয়ন্ত্রণ</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Users className="w-5 h-5" />} label="মোট ব্যবহারকারী" value={fmt(stats?.users || 0)} />
        <StatCard icon={<ShieldCheck className="w-5 h-5" />} label="অ্যাডমিন" value={fmt(stats?.admins || 0)} />
        <StatCard icon={<Crown className="w-5 h-5" />} label="সুপার অ্যাডমিন" value={fmt(stats?.superAdmins || 0)} />
        <StatCard icon={<Activity className="w-5 h-5" />} label="পেন্ডিং" value={fmt(stats?.pending || 0)} />
        <StatCard icon={<Database className="w-5 h-5" />} label="মোট লেনদেন" value={fmt(stats?.transactions || 0)} />
        <StatCard icon={<Database className="w-5 h-5" />} label="বাজেট" value={fmt(stats?.budgets || 0)} />
        <StatCard icon={<Database className="w-5 h-5" />} label="লক্ষ্য" value={fmt(stats?.goals || 0)} />
        <StatCard icon={<Database className="w-5 h-5" />} label="টিকেট" value={fmt(stats?.tickets || 0)} />
      </div>

      <div className="brand-card p-4 md:p-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>রোল ব্যবস্থাপনা</h3>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="নাম, রেফারেন্স বা আইডি…"
            className="px-3 py-2 rounded-lg border text-sm w-full md:w-64"
            style={{ borderColor: "var(--brand-line)" }}
          />
        </div>

        <RequestsInbox requests={requests} onChange={load} />


        {loading ? (
          <div className="py-10 text-center text-slate-500">লোড হচ্ছে…</div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-slate-500">কেউ পাওয়া যায়নি</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b" style={{ borderColor: "var(--brand-line)" }}>
                  <th className="py-2 pr-3">ব্যবহারকারী</th>
                  <th className="py-2 pr-3">রেফারেন্স</th>
                  <th className="py-2 pr-3">যোগদান</th>
                  <th className="py-2 pr-3">বর্তমান রোল</th>
                  <th className="py-2 text-right">কার্যক্রম</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const isSelf = r.user_id === user?.id;
                  return (
                    <tr key={r.user_id} className="border-b last:border-0 hover:bg-slate-50/60" style={{ borderColor: "var(--brand-line)" }}>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: "var(--gradient-brand)" }}>
                            {(r.full_name || "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium">{r.full_name || "—"} {isSelf && <span className="text-xs text-slate-400">(আপনি)</span>}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{r.user_id.slice(0, 8)}…</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-3 font-mono text-xs text-slate-600">{r.ref_code || "—"}</td>
                      <td className="py-3 pr-3 text-slate-600">{new Date(r.created_at).toLocaleDateString("bn-BD")}</td>
                      <td className="py-3 pr-3">
                        <div className="flex gap-1 flex-wrap">
                          {r.is_super_admin && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "color-mix(in oklab, var(--brand-gold-500) 25%, transparent)", color: "var(--brand-emerald-900)" }}>
                              <Crown className="w-3 h-3" /> সুপার
                            </span>
                          )}
                          {r.is_admin && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                              <ShieldCheck className="w-3 h-3" /> অ্যাডমিন
                            </span>
                          )}
                          {!r.is_admin && !r.is_super_admin && <span className="text-xs text-slate-500">সাধারণ</span>}
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex gap-1.5 justify-end flex-wrap">
                          {!r.is_admin ? (
                            <button onClick={() => setPending({ row: r, action: "grant_admin" })} className="text-xs px-2.5 py-1.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 inline-flex items-center gap-1">
                              <Shield className="w-3 h-3" /> অ্যাডমিন বানাও
                            </button>
                          ) : (
                            <button onClick={() => setPending({ row: r, action: "revoke_admin" })} className="text-xs px-2.5 py-1.5 rounded-md border bg-white inline-flex items-center gap-1" style={{ borderColor: "var(--brand-line)" }}>
                              <ShieldOff className="w-3 h-3" /> অ্যাডমিন সরাও
                            </button>
                          )}
                          {!r.is_super_admin ? (
                            <button onClick={() => setPending({ row: r, action: "grant_super" })} className="text-xs px-2.5 py-1.5 rounded-md border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 inline-flex items-center gap-1">
                              <Crown className="w-3 h-3" /> সুপার বানাও
                            </button>
                          ) : (
                            <button disabled={isSelf} onClick={() => setPending({ row: r, action: "revoke_super" })} className="text-xs px-2.5 py-1.5 rounded-md border bg-white inline-flex items-center gap-1 disabled:opacity-40" style={{ borderColor: "var(--brand-line)" }}>
                              <ShieldOff className="w-3 h-3" /> সুপার সরাও
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>আপনি কি নিশ্চিত?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending && (
                <>
                  <strong>{pending.row.full_name || "এই ব্যবহারকারী"}</strong>-কে{" "}
                  {pending.action === "grant_admin" && "অ্যাডমিন বানানো হবে।"}
                  {pending.action === "revoke_admin" && "অ্যাডমিন রোল থেকে সরানো হবে।"}
                  {pending.action === "grant_super" && "সুপার অ্যাডমিন বানানো হবে — সম্পূর্ণ নিয়ন্ত্রণ পাবে!"}
                  {pending.action === "revoke_super" && "সুপার অ্যাডমিন থেকে সরানো হবে।"}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>বাতিল</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={confirm}>{busy ? "অপেক্ষা…" : "নিশ্চিত"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="brand-card p-4">
      <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
        <span style={{ color: "var(--brand-emerald-700)" }}>{icon}</span>
        {label}
      </div>
      <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{value}</div>
    </div>
  );
}

function AccessDeniedWithRequest() {
  const { user } = useAuth();
  const [myRequests, setMyRequests] = useState<RoleRequest[]>([]);
  const [requestedRole, setRequestedRole] = useState<"admin" | "super_admin">("super_admin");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("role_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setMyRequests((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const hasPending = myRequests.some(r => r.status === "pending" && r.requested_role === requestedRole);

  const submit = async () => {
    if (!user) return;
    if (!reason.trim()) { toast.error("কারণ লিখুন"); return; }
    setSubmitting(true);
    const t = toast.loading("পাঠানো হচ্ছে…");
    const { error } = await supabase.from("role_requests").insert({
      user_id: user.id, requested_role: requestedRole, reason: reason.trim(),
    });
    if (error) { toast.error(error.message, { id: t }); setSubmitting(false); return; }
    toast.success("রিকোয়েস্ট পাঠানো হয়েছে", { id: t });
    setReason("");
    setSubmitting(false);
    load();
  };

  return (
    <AppShell title="সুপার অ্যাডমিন">
      <div className="max-w-2xl mx-auto space-y-5 mt-6">
        <div className="brand-card p-6 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-amber-500" />
          <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: "var(--font-display)" }}>অ্যাক্সেস নেই</h2>
          <p className="text-sm text-slate-600">
            এই পেজটি দেখতে <strong>সুপার অ্যাডমিন</strong> অনুমতি প্রয়োজন।
            নিচ থেকে অ্যাডমিনকে রিকোয়েস্ট পাঠাতে পারেন।
          </p>
        </div>

        <div className="brand-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Send className="w-5 h-5" style={{ color: "var(--brand-emerald-700)" }} />
            <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>রোল রিকোয়েস্ট পাঠান</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">যে রোল চান</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRequestedRole("admin")}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm inline-flex items-center justify-center gap-2 ${requestedRole === "admin" ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-white"}`}
                  style={requestedRole === "admin" ? undefined : { borderColor: "var(--brand-line)" }}
                >
                  <ShieldCheck className="w-4 h-4" /> অ্যাডমিন
                </button>
                <button
                  type="button"
                  onClick={() => setRequestedRole("super_admin")}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm inline-flex items-center justify-center gap-2 ${requestedRole === "super_admin" ? "bg-amber-50 border-amber-300 text-amber-800" : "bg-white"}`}
                  style={requestedRole === "super_admin" ? undefined : { borderColor: "var(--brand-line)" }}
                >
                  <Crown className="w-4 h-4" /> সুপার অ্যাডমিন
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">কারণ</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="কেন এই রোল প্রয়োজন তা সংক্ষেপে লিখুন…"
                rows={3}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: "var(--brand-line)" }}
              />
            </div>
            <button
              onClick={submit}
              disabled={submitting || hasPending}
              className="w-full px-4 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
              style={{ background: "var(--gradient-brand)" }}
            >
              <Send className="w-4 h-4" />
              {hasPending ? "এই রোলের জন্য পেন্ডিং রিকোয়েস্ট আছে" : submitting ? "পাঠানো হচ্ছে…" : "রিকোয়েস্ট পাঠান"}
            </button>
          </div>
        </div>

        <div className="brand-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Inbox className="w-5 h-5" style={{ color: "var(--brand-emerald-700)" }} />
            <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>আপনার রিকোয়েস্ট</h3>
          </div>
          {loading ? (
            <div className="py-6 text-center text-slate-500 text-sm">লোড হচ্ছে…</div>
          ) : myRequests.length === 0 ? (
            <div className="py-6 text-center text-slate-500 text-sm">কোনো রিকোয়েস্ট নেই</div>
          ) : (
            <div className="space-y-2">
              {myRequests.map(r => <RequestStatusRow key={r.id} req={r} />)}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function RequestStatusRow({ req }: { req: RoleRequest }) {
  const badge = req.status === "pending"
    ? { cls: "bg-amber-100 text-amber-800", icon: <Clock className="w-3 h-3" />, label: "পেন্ডিং" }
    : req.status === "approved"
    ? { cls: "bg-emerald-100 text-emerald-700", icon: <Check className="w-3 h-3" />, label: "অনুমোদিত" }
    : { cls: "bg-rose-100 text-rose-700", icon: <X className="w-3 h-3" />, label: "প্রত্যাখ্যাত" };
  return (
    <div className="border rounded-lg p-3 text-sm" style={{ borderColor: "var(--brand-line)" }}>
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          {req.requested_role === "super_admin" ? <Crown className="w-4 h-4 text-amber-600" /> : <ShieldCheck className="w-4 h-4 text-emerald-700" />}
          <span className="font-medium">{req.requested_role === "super_admin" ? "সুপার অ্যাডমিন" : "অ্যাডমিন"}</span>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
          {badge.icon} {badge.label}
        </span>
      </div>
      {req.reason && <div className="text-slate-600 text-xs mb-1">{req.reason}</div>}
      {req.review_note && <div className="text-slate-500 text-xs italic">পর্যালোচকের নোট: {req.review_note}</div>}
      <div className="text-[11px] text-slate-400 mt-1">{new Date(req.created_at).toLocaleString("bn-BD")}</div>
    </div>
  );
}

function RequestsInbox({ requests, onChange }: { requests: RoleRequest[]; onChange: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const pendingReqs = requests.filter(r => r.status === "pending");

  const act = async (id: string, kind: "approve" | "reject") => {
    const note = kind === "reject" ? (window.prompt("প্রত্যাখ্যানের কারণ (ঐচ্ছিক):") || undefined) : undefined;
    setBusyId(id);
    const t = toast.loading("প্রসেস হচ্ছে…");
    const fn = kind === "approve" ? "approve_role_request" : "reject_role_request";
    const { error } = await supabase.rpc(fn, { _request_id: id, _note: note });
    if (error) toast.error(error.message, { id: t });
    else { toast.success("সম্পন্ন", { id: t }); onChange(); }
    setBusyId(null);
  };

  return (
    <div className="mb-6 border rounded-xl p-4" style={{ borderColor: "var(--brand-line)", background: "color-mix(in oklab, var(--brand-gold-500) 5%, transparent)" }}>
      <div className="flex items-center gap-2 mb-3">
        <Inbox className="w-4 h-4" style={{ color: "var(--brand-emerald-700)" }} />
        <h4 className="font-semibold text-sm" style={{ fontFamily: "var(--font-display)" }}>
          রোল রিকোয়েস্ট ইনবক্স {pendingReqs.length > 0 && <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-xs">{pendingReqs.length}</span>}
        </h4>
      </div>
      {pendingReqs.length === 0 ? (
        <div className="text-xs text-slate-500 py-2">কোনো পেন্ডিং রিকোয়েস্ট নেই</div>
      ) : (
        <div className="space-y-2">
          {pendingReqs.map(r => (
            <div key={r.id} className="bg-white border rounded-lg p-3 flex items-start gap-3 flex-wrap" style={{ borderColor: "var(--brand-line)" }}>
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 text-sm mb-1">
                  <strong>{r.full_name || r.user_id.slice(0, 8) + "…"}</strong>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                    {r.requested_role === "super_admin" ? <Crown className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                    {r.requested_role === "super_admin" ? "সুপার" : "অ্যাডমিন"}
                  </span>
                </div>
                {r.reason && <div className="text-xs text-slate-600">{r.reason}</div>}
                <div className="text-[11px] text-slate-400 mt-1">{new Date(r.created_at).toLocaleString("bn-BD")}</div>
              </div>
              <div className="flex gap-1.5">
                <button disabled={busyId === r.id} onClick={() => act(r.id, "approve")} className="text-xs px-2.5 py-1.5 rounded-md border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 inline-flex items-center gap-1 disabled:opacity-50">
                  <Check className="w-3 h-3" /> অনুমোদন
                </button>
                <button disabled={busyId === r.id} onClick={() => act(r.id, "reject")} className="text-xs px-2.5 py-1.5 rounded-md border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 inline-flex items-center gap-1 disabled:opacity-50">
                  <X className="w-3 h-3" /> প্রত্যাখ্যান
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}