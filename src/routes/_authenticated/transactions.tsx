import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { TxnDialog, type EditTxn } from "@/components/dashboard/TxnDialog";
import { fmtTk, toBn } from "@/lib/finance";
import { useCustomCategories } from "@/hooks/useCustomCategories";
import { ArrowUp, ArrowDown, Plus, Trash2, Pencil, TrendingUp, TrendingDown, Activity, Calendar, AlertCircle, ArrowDownRight } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { deleteTxnOffline } from "@/lib/offline-tx";

export const Route = createFileRoute("/_authenticated/transactions")({
  component: TransactionsPage,
});

type Txn = { id: string; type: "income" | "expense"; category: string; amount: number; occurred_on: string; note: string | null };

const PAGE_SIZE = 50;

function Sparkline({ points, stroke = "#fff" }: { points: number[]; stroke?: string }) {
  if (!points.length) return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const w = 120, h = 36;
  const step = w / Math.max(1, points.length - 1);
  const path = points.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <path d={path} fill="none" stroke={stroke} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <path d={`${path} L${w},${h} L0,${h} Z`} fill={stroke} opacity={0.18} />
    </svg>
  );
}

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
      if (debouncedQ) {
        const esc = debouncedQ.replace(/[,()]/g, " ").trim();
        if (esc) query = query.or(`note.ilike.%${esc}%,category.ilike.%${esc}%`);
      }
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

  const { spark, thisMonth, lastMonth, topCat } = useMemo(() => {
    const days = 14;
    const today = new Date();
    const buckets = new Array(days).fill(0);
    for (const t of filtered) {
      const d = new Date(t.occurred_on);
      const diff = Math.floor((+today - +d) / 86400000);
      if (diff >= 0 && diff < days) buckets[days - 1 - diff] += Number(t.amount);
    }
    const ym = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
    const tm = ym(today);
    const lm = ym(new Date(today.getFullYear(), today.getMonth() - 1, 1));
    let tmSum = 0, lmSum = 0;
    const catMap: Record<string, number> = {};
    for (const t of filtered) {
      const d = new Date(t.occurred_on);
      const amt = Number(t.amount);
      if (ym(d) === tm) tmSum += amt;
      if (ym(d) === lm) lmSum += amt;
      catMap[t.category] = (catMap[t.category] ?? 0) + amt;
    }
    const top = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
    return { spark: buckets, thisMonth: tmSum, lastMonth: lmSum, topCat: top };
  }, [filtered]);
  const momPct = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : (thisMonth > 0 ? 100 : 0);

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
    const r = await deleteTxnOffline(uid!, id);
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(r.queued
      ? t("অফলাইন ডিলিট জমা হয়েছে — অনলাইন হলে সিঙ্ক হবে", "Delete queued — will sync when online")
      : t("মুছে ফেলা হয়েছে", "Deleted"));
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };
  const openEdit = (t: Txn) => {
    setEditing({ id: t.id, type: t.type, category: t.category, amount: Number(t.amount), occurred_on: t.occurred_on, note: t.note });
    setOpen(true);
  };
  const openNew = () => { setEditing(null); setOpen(true); };

  return (
    <AppShell title={t("লেনদেন", "Transactions")} actions={
      <div className="flex items-center gap-2">
        <button onClick={openNew} className="group flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg text-sm font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] transition-all">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">{t("নতুন লেনদেন", "New transaction")}</span><span className="sm:hidden">{t("যোগ", "Add")}</span>
        </button>
      </div>
    }>
      {/* Hero summary */}
      <div className="relative overflow-hidden rounded-2xl p-5 sm:p-7 mb-5 text-white shadow-2xl shadow-indigo-500/30"
        style={{ background: "linear-gradient(135deg,#4f46e5 0%,#7c3aed 45%,#a855f7 100%)" }}>
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-fuchsia-300/20 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-indigo-50/90 text-xs font-medium tracking-wider uppercase mb-2">
              <Activity className="w-3.5 h-3.5" /> {t("নিট ব্যালেন্স", "Net balance")}
            </div>
            <div className={`text-3xl sm:text-4xl font-extrabold tracking-tight drop-shadow-sm`}>{net >= 0 ? "+" : ""}{fmtTk(net)}</div>
            <div className="flex flex-wrap items-center gap-3 mt-3 text-sm">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="font-semibold">{fmtTk(totalInc)}</span>
                <span className="text-indigo-50/80 text-xs">{t("আয়", "Income")}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
                <TrendingDown className="w-3.5 h-3.5" />
                <span className="font-semibold">{fmtTk(totalExp)}</span>
                <span className="text-indigo-50/80 text-xs">{t("ব্যয়", "Expense")}</span>
              </span>
              <span className="text-indigo-50/80 text-xs">{t("মোট লেনদেন", "Total transactions")}: <b className="text-white">{toBn(filtered.length)}{txnQ.hasNextPage ? "+" : ""}</b></span>
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <div className="text-[11px] uppercase tracking-wider text-indigo-50/80">{t("শেষ ১৪ দিন", "Last 14 days")}</div>
            <Sparkline points={spark} />
          </div>
        </div>
        <div className="relative flex flex-wrap items-center gap-3 mt-4 text-sm">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
            <ArrowDownRight className={`w-3.5 h-3.5 ${momPct >= 0 ? "" : "rotate-180"}`} />
            <span className="font-semibold">{momPct >= 0 ? "+" : ""}{toBn(momPct.toFixed(1))}%</span>
            <span className="text-indigo-50/80 text-xs">{t("গত মাসের তুলনায়", "vs last month")}</span>
          </span>
        </div>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-5">
        <div className="relative overflow-hidden bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-400 to-pink-400" />
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{t("এই মাস", "This month")}</div>
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center"><Calendar className="w-4 h-4 text-rose-600" /></div>
          </div>
          <div className="text-xl font-extrabold text-slate-800 mt-1">{fmtTk(thisMonth)}</div>
        </div>
        <div className="relative overflow-hidden bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-indigo-400" />
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{t("গত মাস", "Last month")}</div>
            <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center"><TrendingDown className="w-4 h-4 text-sky-600" /></div>
          </div>
          <div className="text-xl font-extrabold text-slate-800 mt-1">{fmtTk(lastMonth)}</div>
        </div>
        <div className="col-span-2 lg:col-span-1 relative overflow-hidden bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{t("শীর্ষ খাত", "Top category")}</div>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center"><AlertCircle className="w-4 h-4 text-amber-600" /></div>
          </div>
          <div className="text-base font-bold text-slate-800 mt-1 truncate">{topCat?.[0] ?? "—"}</div>
          {topCat && <div className="text-xs text-slate-500 font-medium">{fmtTk(topCat[1])}</div>}
        </div>
      </div>

      {/* Filters + Search */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            {(["all", "income", "expense"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${filter === f ? (f === "income" ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow" : f === "expense" ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow" : "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow") : "text-slate-500 hover:text-slate-700"}`}
              >
                {f === "all" ? t("সব", "All") : f === "income" ? t("আয়", "Income") : t("ব্যয়", "Expense")}
              </button>
            ))}
          </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 focus:outline-none shadow-sm">
          <option value="">{t("সব ক্যাটাগরি", "All categories")}</option>
          {(filter === "all" ? combined : forType(filter)).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("ক্যাটাগরি বা নোট খুঁজুন...", "Search category or note...")}
            className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"/></svg>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-600">
          <span className="text-slate-400">{t("দেখাচ্ছে", "Showing")}:</span> <b>{toBn(filtered.length)}</b>
        </div>
      </div>

        {/* Desktop table */}
        <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gradient-to-r from-slate-50 to-indigo-50/40 text-slate-600 text-xs">
              <tr>
                <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider">{t("ধরন", "Type")}</th>
                <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider">{t("ক্যাটাগরি", "Category")}</th>
                <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider">{t("নোট", "Note")}</th>
                <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider">{t("তারিখ", "Date")}</th>
                <th className="text-right px-4 py-3 font-semibold uppercase tracking-wider">{t("পরিমাণ", "Amount")}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {txnQ.isLoading && (
                <tr><td colSpan={6} className="text-center text-slate-400 py-8">{t("লোড হচ্ছে...", "Loading...")}</td></tr>
              )}
              {!txnQ.isLoading && filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12">
                  <div className="inline-flex flex-col items-center gap-2">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center"><Activity className="w-7 h-7 text-indigo-600" /></div>
                    <div className="text-slate-500 text-sm">{t("কোনো লেনদেন নেই", "No transactions")}</div>
                  </div>
                </td></tr>
              )}
              {filtered.map((tx) => {
                const inc = tx.type === "income";
                return (
                  <tr key={tx.id} className={`group border-t border-slate-100 ${inc ? "hover:bg-emerald-50/30" : "hover:bg-rose-50/30"} transition-colors`}>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 ${inc ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}>
                        {inc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                        {inc ? t("আয়", "Income") : t("ব্যয়", "Expense")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ring-2 ${inc ? "bg-gradient-to-br from-emerald-400 to-teal-500 ring-emerald-100" : "bg-gradient-to-br from-rose-400 to-pink-500 ring-rose-100"}`} />
                        <span className="font-medium text-slate-700">{tx.category}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{tx.note || "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{toBn(tx.occurred_on)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${inc ? "text-emerald-600" : "text-rose-600"}`}>{inc ? "+" : "−"}{fmtTk(Number(tx.amount))}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(tx)} className="p-1.5 rounded-md hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 transition-colors" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(tx.id)} className="p-1.5 rounded-md hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-colors" title="Delete">
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

        {/* Mobile / tablet card list */}
        <div className="lg:hidden space-y-2">
          {txnQ.isLoading && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-400 text-sm">{t("লোড হচ্ছে...", "Loading...")}</div>
          )}
          {!txnQ.isLoading && filtered.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mb-3"><Activity className="w-7 h-7 text-indigo-600" /></div>
              <div className="text-slate-500 text-sm">{t("কোনো লেনদেন নেই", "No transactions")}</div>
            </div>
          )}
          {filtered.map((tx) => {
            const inc = tx.type === "income";
            return (
              <div key={tx.id} className="relative bg-white rounded-xl border border-slate-200 p-3 flex items-start gap-3 shadow-sm hover:shadow-md transition-all overflow-hidden">
                <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${inc ? "from-emerald-400 to-teal-500" : "from-rose-400 to-pink-500"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-slate-800 text-sm truncate">{tx.category}</div>
                    <div className={`font-bold text-sm whitespace-nowrap ${inc ? "text-emerald-600" : "text-rose-600"}`}>{inc ? "+" : "−"}{fmtTk(Number(tx.amount))}</div>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${inc ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}>
                      {inc ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                      {inc ? t("আয়", "Income") : t("ব্যয়", "Expense")}
                    </span>
                  </div>
                  {tx.note && <div className="text-xs text-slate-600 mt-0.5 truncate">{tx.note}</div>}
                  <div className="text-[11px] text-slate-400 mt-1">{toBn(tx.occurred_on)}</div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => openEdit(tx)} className="p-1.5 rounded-md hover:bg-indigo-50 text-slate-400 hover:text-indigo-600" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(tx.id)} className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
          {/* Sentinel + footer (mobile) */}
          <div ref={sentinelRef} />
          {txnQ.isFetchingNextPage && (
            <div className="text-center text-slate-400 text-xs py-4">{t("আরও লোড হচ্ছে...", "Loading more...")}</div>
          )}
          {!txnQ.hasNextPage && filtered.length > 0 && (
            <div className="text-center text-slate-300 text-xs py-4">— {t("শেষ", "End")} —</div>
          )}
        </div>
      <TxnDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }} editTxn={editing} />
    </AppShell>
  );
}