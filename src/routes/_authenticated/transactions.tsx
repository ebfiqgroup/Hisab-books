import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { TxnDialog, type EditTxn } from "@/components/dashboard/TxnDialog";
import { fmtTk, toBn } from "@/lib/finance";
import { useCustomCategories } from "@/hooks/useCustomCategories";
import { ArrowUp, ArrowDown, Plus, Trash2, ArrowLeft, Search, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";

export const Route = createFileRoute("/_authenticated/transactions")({
  component: TransactionsPage,
});

type Txn = { id: string; type: "income" | "expense"; category: string; amount: number; occurred_on: string; note: string | null };

const PAGE_SIZE = 50;

function TransactionsPage() {
  const { t } = useLanguage();
  const qc = useQueryClient();
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
    queryKey: ["transactions", "list", filter, cat, debouncedQ],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from("transactions")
        .select("id,type,category,amount,occurred_on,note")
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
    const { error } = await supabase.from("transactions").delete().eq("id", id);
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
    <div className="h-screen flex overflow-hidden" style={{ background: "oklch(0.97 0.005 250)" }}>
      <Sidebar />
      <main className="flex-1 p-6 overflow-y-auto h-screen">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/app" className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50">
              <ArrowLeft className="w-4 h-4 text-slate-600" />
            </Link>
            <h1 className="text-2xl font-bold text-slate-800">{t("সব লেনদেন", "All transactions")}</h1>
          </div>
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> {t("নতুন লেনদেন", "New transaction")}
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-xs text-slate-500">{t("মোট লেনদেন", "Total transactions")}</div>
            <div className="text-xl font-bold text-slate-800">{toBn(filtered.length)}{txnQ.hasNextPage ? "+" : ""}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-xs text-slate-500">{t("মোট আয়", "Total income")}</div>
            <div className="text-xl font-bold text-emerald-600">{fmtTk(totalInc)}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-xs text-slate-500">{t("মোট ব্যয়", "Total expense")}</div>
            <div className="text-xl font-bold text-rose-500">{fmtTk(totalExp)}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 mb-4 flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 rounded-lg p-1">
            {(["all", "income", "expense"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs rounded-md ${filter === f ? "bg-white shadow text-slate-800" : "text-slate-500"}`}
              >
                {f === "all" ? t("সব", "All") : f === "income" ? t("আয়", "Income") : t("ব্যয়", "Expense")}
              </button>
            ))}
          </div>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white">
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
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs">
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
                  <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${inc ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`}>
                        {inc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                        {inc ? "Income" : "Expense"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{t.category}</td>
                    <td className="px-4 py-3 text-slate-600">{t.note || "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{toBn(t.occurred_on)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${inc ? "text-emerald-600" : "text-rose-500"}`}>{fmtTk(Number(t.amount))}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(t)} className="p-1.5 rounded-md hover:bg-indigo-50 text-slate-400 hover:text-indigo-600" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(t.id)} className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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