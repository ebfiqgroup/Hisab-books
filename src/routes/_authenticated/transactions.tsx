import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { TxnDialog, type EditTxn } from "@/components/dashboard/TxnDialog";
import { fmtTk, toBn } from "@/lib/finance";
import { useCustomCategories } from "@/hooks/useCustomCategories";
import { ArrowUp, ArrowDown, Plus, Trash2, ArrowLeft, Search, Pencil, Wallet, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";

export const Route = createFileRoute("/_authenticated/transactions")({
  component: TransactionsPage,
});

type Txn = { id: string; type: "income" | "expense"; category: string; amount: number; occurred_on: string; note: string | null };

const PAGE_SIZE = 50;

function TransactionsPage() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const uid = useCurrentUserId();
  const { forType, combined } = useCustomCategories();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EditTxn | null>(null);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [cat, setCat] = useState<string>("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const txnQ = useInfiniteQuery({
    queryKey: ["transactions", "list", uid, filter, cat, debouncedQ],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from("transactions")
        .select("id,type,category,amount,occurred_on,note")
        .eq("user_id", uid)
        .order("occurred_on", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to);
      if (filter !== "all") query = query.eq("type", filter);
      if (cat) query = query.eq("category", cat);
      if (debouncedQ) query = query.ilike("note", `%${debouncedQ}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Txn[];
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length,
  });

  const filtered = useMemo(
    () => (txnQ.data?.pages ?? []).flat(),
    [txnQ.data],
  );

  const totalInc = filtered.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalExp = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const net = totalInc - totalExp;
  const incPct = totalInc + totalExp > 0 ? Math.round((totalInc / (totalInc + totalExp)) * 100) : 0;

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && txnQ.hasNextPage && !txnQ.isFetchingNextPage) {
        txnQ.fetchNextPage();
      }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [txnQ.hasNextPage, txnQ.isFetchingNextPage, txnQ.fetchNextPage]);

  const remove = async (id: string) => {
    if (!confirm(t("লেনদেনটি মুছে ফেলবেন?", "Delete this transaction?"))) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id).eq("user_id", uid);
    if (error) { toast.error(error.message); return; }
    toast.success(t("মুছে ফেলা হয়েছে", "Deleted"));
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };
  const openEdit = (t: Txn) => {
    setEditing({ id: t.id, type: t.type, category: t.category, amount: Number(t.amount), occurred_on: t.occurred_on, note: t.note });
    setOpen(true);
  };
  const openNew = () => { setEditing(null); setOpen(true); };

  return (
    <div className="h-screen flex overflow-hidden bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/40">
      <Sidebar />
      <main className="flex-1 p-6 overflow-y-auto h-screen">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl mb-6 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 shadow-xl shadow-indigo-300/40">
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-10 w-72 h-72 bg-fuchsia-300/20 rounded-full blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link to="/app" className="p-2 rounded-xl bg-white/15 backdrop-blur border border-white/20 hover:bg-white/25 transition">
                <ArrowLeft className="w-4 h-4 text-white" />
              </Link>
              <div className="p-3 rounded-2xl bg-white/15 backdrop-blur border border-white/20">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{t("সব লেনদেন", "All transactions")}</h1>
                <p className="text-xs text-white/70">{t("সকল আয় ও ব্যয়ের সম্পূর্ণ ইতিহাস", "Complete history of all income & expense")}</p>
              </div>
            </div>
            <button onClick={openNew} className="flex items-center gap-2 px-5 py-2.5 bg-white text-indigo-700 rounded-xl text-sm font-semibold hover:bg-white/90 shadow-lg shadow-indigo-900/20 transition hover:-translate-y-0.5">
              <Plus className="w-4 h-4" /> {t("নতুন লেনদেন", "New transaction")}
            </button>
          </div>
          <div className="relative mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl bg-white/10 backdrop-blur border border-white/15 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-white/70"><Wallet className="w-3 h-3"/>{t("মোট", "Total")}</div>
              <div className="text-xl font-bold text-white mt-1">{toBn(filtered.length)}{txnQ.hasNextPage ? "+" : ""}</div>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur border border-white/15 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-200"><TrendingUp className="w-3 h-3"/>{t("আয়", "Income")}</div>
              <div className="text-base font-bold text-white mt-1">{fmtTk(totalInc)}</div>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur border border-white/15 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-rose-200"><TrendingDown className="w-3 h-3"/>{t("ব্যয়", "Expense")}</div>
              <div className="text-base font-bold text-white mt-1">{fmtTk(totalExp)}</div>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur border border-white/15 p-3">
              <div className="text-[11px] text-white/70">{t("নিট", "Net")}</div>
              <div className={`text-base font-bold mt-1 ${net >= 0 ? "text-emerald-200" : "text-rose-200"}`}>{fmtTk(net)}</div>
            </div>
          </div>
          {totalInc + totalExp > 0 && (
            <div className="relative mt-4 h-2 rounded-full overflow-hidden bg-white/15">
              <div className="h-full bg-gradient-to-r from-emerald-300 to-emerald-400" style={{ width: `${incPct}%` }} />
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white/80 backdrop-blur rounded-2xl p-4 border border-slate-200/70 shadow-sm mb-4 flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 rounded-lg p-1">
            {(["all", "income", "expense"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition ${filter === f ? (f === "income" ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow" : f === "expense" ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow" : "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow") : "text-slate-500 hover:text-slate-700"}`}
              >
                {f === "all" ? t("সব", "All") : f === "income" ? t("আয়", "Income") : t("ব্যয়", "Expense")}
              </button>
            ))}
          </div>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-400 focus:outline-none">
            <option value="">{t("সব ক্যাটাগরি", "All categories")}</option>
            {(filter === "all" ? combined : forType(filter)).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("অনুসন্ধান...", "Search...")}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-indigo-300 focus:outline-none"
            />
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gradient-to-r from-slate-50 via-indigo-50/50 to-violet-50/40 text-slate-600 text-xs">
              <tr>
                <th className="text-left px-4 py-3 font-medium">{t("ধরন", "Type")}</th>
                <th className="text-left px-4 py-3 font-medium">{t("ক্যাটাগরি", "Category")}</th>
                <th className="text-left px-4 py-3 font-medium">{t("নোট", "Note")}</th>
                <th className="text-left px-4 py-3 font-medium">{t("তারিখ", "Date")}</th>
                <th className="text-right px-4 py-3 font-medium">{t("পরিমাণ", "Amount")}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {txnQ.isLoading && (
                <tr><td colSpan={6} className="text-center text-slate-400 py-8">{t("লোড হচ্ছে...", "Loading...")}</td></tr>
              )}
              {!txnQ.isLoading && filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center text-slate-400 py-8">{t("কোনো লেনদেন নেই", "No transactions")}</td></tr>
              )}
              {filtered.map((t) => {
                const inc = t.type === "income";
                return (
                  <tr key={t.id} className={`group border-t border-slate-100 hover:bg-gradient-to-r transition ${inc ? "hover:from-emerald-50/40 hover:to-transparent" : "hover:from-rose-50/40 hover:to-transparent"} relative`}>
                    <td className={`px-4 py-3 border-l-2 ${inc ? "border-l-emerald-400" : "border-l-rose-400"}`}>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${inc ? "bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-gradient-to-r from-rose-50 to-pink-50 text-rose-600 ring-1 ring-rose-200"}`}>
                        {inc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                        {inc ? "Income" : "Expense"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{t.category}</td>
                    <td className="px-4 py-3 text-slate-600">{t.note || "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{toBn(t.occurred_on)}</td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${inc ? "text-emerald-600" : "text-rose-500"}`}>{inc ? "+" : "−"} {fmtTk(Number(t.amount))}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(t)} className="p-1.5 rounded-md hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 transition" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(t.id)} className="p-1.5 rounded-md hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {/* Sentinel + footer */}
          <div ref={sentinelRef} />
          {txnQ.isFetchingNextPage && (
            <div className="text-center text-slate-400 text-xs py-4">{t("আরও লোড হচ্ছে...", "Loading more...")}</div>
          )}
          {!txnQ.hasNextPage && filtered.length > 0 && (
            <div className="text-center text-slate-300 text-xs py-4">— {t("শেষ", "End")} —</div>
          )}
        </div>
      </main>
      <TxnDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }} editTxn={editing} />
    </div>
  );
}