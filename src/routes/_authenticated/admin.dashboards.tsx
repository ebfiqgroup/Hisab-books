import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useRole";
import { UserDashboardView } from "@/components/admin/UserDashboardView";
import { toast } from "sonner";
import {
  ChevronDown, ChevronUp, Search, RefreshCw, CheckCircle2, Clock, Ban,
  Trash2, Plus, ShieldCheck, UserCircle2, ExternalLink, Wallet, TrendingDown,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { fmtTk } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/admin/dashboards")({
  component: AdminDashboardsPage,
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

function AdminDashboardsPage() {
  const isAdmin = useIsAdmin();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "suspended">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!term) return true;
      return (
        (r.full_name || "").toLowerCase().includes(term) ||
        (r.ref_code || "").toLowerCase().includes(term) ||
        r.user_id.toLowerCase().includes(term)
      );
    });
  }, [rows, q, statusFilter]);

  const toggle = (id: string) => {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const setStatus = async (row: Row, status: "pending" | "approved" | "suspended") => {
    setBusy(row.user_id);
    try {
      const { error } = await supabase.rpc("admin_set_user_status", { _user_id: row.user_id, _status: status });
      if (error) throw error;
      toast.success("স্ট্যাটাস আপডেট হয়েছে");
      setRows((rs) => rs.map((r) => r.user_id === row.user_id ? { ...r, status } : r));
    } catch (e: any) {
      toast.error(e.message || "ত্রুটি");
    } finally {
      setBusy(null);
    }
  };

  const doDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.rpc("admin_delete_user", { _user_id: toDelete.user_id });
      if (error) throw error;
      toast.success("অ্যাকাউন্ট মুছে ফেলা হয়েছে");
      setRows((rs) => rs.filter((r) => r.user_id !== toDelete.user_id));
      setToDelete(null);
    } catch (e: any) {
      toast.error(e.message || "মুছতে ব্যর্থ");
    } finally {
      setDeleting(false);
    }
  };

  if (isAdmin === null) return <AppShell title="সব ড্যাশবোর্ড"><div className="p-8 text-slate-500">লোড হচ্ছে…</div></AppShell>;
  if (!isAdmin) return <AppShell title="সব ড্যাশবোর্ড"><div className="p-8 text-rose-600">অনুমতি নেই</div></AppShell>;

  return (
    <AppShell title="সব ড্যাশবোর্ড">
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">সব ব্যবহারকারীর ড্যাশবোর্ড</h1>
            <p className="text-sm text-slate-500 mt-1">প্রতিটি কার্ডে "বিস্তারিত দেখুন" চাপলে সম্পূর্ণ ড্যাশবোর্ড দেখা যাবে</p>
          </div>
          <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white hover:bg-slate-50 text-sm">
            <RefreshCw className="w-4 h-4" /> রিফ্রেশ
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="নাম, রেফ কোড বা আইডি দিয়ে খুঁজুন…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border bg-white text-sm"
            />
          </div>
          <div className="flex gap-1 rounded-lg border bg-white p-1">
            {(["all", "pending", "approved", "suspended"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${statusFilter === s ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {s === "all" ? "সব" : s === "pending" ? "পেন্ডিং" : s === "approved" ? "অনুমোদিত" : "স্থগিত"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">লোড হচ্ছে…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500 border rounded-xl bg-white">কোনো ব্যবহারকারী পাওয়া যায়নি</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((row) => (
              <UserCard
                key={row.user_id}
                row={row}
                expanded={expanded.has(row.user_id)}
                onToggle={() => toggle(row.user_id)}
                onStatus={(s) => setStatus(row, s)}
                onDelete={() => setToDelete(row)}
                busy={busy === row.user_id}
              />
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>অ্যাকাউন্ট মুছবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{toDelete?.full_name || toDelete?.user_id}</strong> এর সম্পূর্ণ অ্যাকাউন্ট ও সব ডেটা স্থায়ীভাবে মুছে যাবে। এই কাজ ফিরিয়ে আনা যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} disabled={deleting} className="bg-rose-600 hover:bg-rose-700">
              {deleting ? "মোছা হচ্ছে…" : "নিশ্চিতভাবে মুছুন"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function UserCard({
  row, expanded, onToggle, onStatus, onDelete, busy,
}: {
  row: Row;
  expanded: boolean;
  onToggle: () => void;
  onStatus: (s: "pending" | "approved" | "suspended") => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const statusBadge = row.status === "approved"
    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
    : row.status === "pending"
    ? "bg-amber-100 text-amber-700 border-amber-200"
    : "bg-rose-100 text-rose-700 border-rose-200";
  const statusLabel = row.status === "approved" ? "অনুমোদিত" : row.status === "pending" ? "পেন্ডিং" : "স্থগিত";

  return (
    <div className="border rounded-xl bg-white overflow-hidden">
      <div className="p-4 flex flex-col lg:flex-row gap-4 lg:items-center">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {row.avatar_url ? (
            <img src={row.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <UserCircle2 className="w-7 h-7" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate">{row.full_name || "নামহীন"}</span>
              {row.is_admin && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <ShieldCheck className="w-3 h-3" /> অ্যাডমিন
                </span>
              )}
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusBadge}`}>{statusLabel}</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-3">
              {row.ref_code && <span>রেফ: {row.ref_code}</span>}
              <span className="inline-flex items-center gap-1 text-emerald-600"><Wallet className="w-3 h-3" />{fmtTk(row.total_income || 0)}</span>
              <span className="inline-flex items-center gap-1 text-rose-600"><TrendingDown className="w-3 h-3" />{fmtTk(row.total_expense || 0)}</span>
              <span>{row.tx_count} লেনদেন</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onStatus("approved")}
            disabled={busy || row.status === "approved"}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs border bg-white hover:bg-emerald-50 text-emerald-700 disabled:opacity-40"
            title="অনুমোদন"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> অনুমোদন
          </button>
          <button
            onClick={() => onStatus("pending")}
            disabled={busy || row.status === "pending"}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs border bg-white hover:bg-amber-50 text-amber-700 disabled:opacity-40"
          >
            <Clock className="w-3.5 h-3.5" /> পেন্ডিং
          </button>
          <button
            onClick={() => onStatus("suspended")}
            disabled={busy || row.status === "suspended"}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs border bg-white hover:bg-rose-50 text-rose-700 disabled:opacity-40"
          >
            <Ban className="w-3.5 h-3.5" /> স্থগিত
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs border bg-white hover:bg-rose-50 text-rose-700"
          >
            <Trash2 className="w-3.5 h-3.5" /> মুছুন
          </button>
          <Link
            to="/admin/user/$userId"
            params={{ userId: row.user_id }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs border bg-white hover:bg-slate-50"
          >
            <ExternalLink className="w-3.5 h-3.5" /> ফুল পেজ
          </Link>
          <button
            onClick={onToggle}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-slate-900 text-white hover:bg-slate-800"
          >
            {expanded ? <><ChevronUp className="w-3.5 h-3.5" /> গুটান</> : <><ChevronDown className="w-3.5 h-3.5" /> বিস্তারিত দেখুন</>}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-slate-50/50 p-3 sm:p-4">
          <UserDashboardView userId={row.user_id} showHeader={true} showToolbar={true} compact />
        </div>
      )}
    </div>
  );
}
