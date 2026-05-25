import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { TxnDialog, type EditTxn } from "@/components/dashboard/TxnDialog";
import { CategoryManager } from "@/components/dashboard/CategoryManager";
import { fmtTk, toBn } from "@/lib/finance";
import { Plus, Trash2, Wallet, Pencil, Tags, TrendingUp, Sparkles, Calendar, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";

export const Route = createFileRoute("/_authenticated/income")({ component: IncomePage });

type Txn = { id: string; type: "income" | "expense"; category: string; amount: number; occurred_on: string; note: string | null };

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

function IncomePage() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const uid = useCurrentUserId();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EditTxn | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = useQuery({
    queryKey: ["transactions", "income", uid],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("id,type,category,amount,occurred_on,note").eq("user_id", uid).eq("type", "income").order("occurred_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Txn[];
    },
  });
  const all = q.data ?? [];
  const list = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return all;
    return all.filter((t) => t.category.toLowerCase().includes(s) || (t.note ?? "").toLowerCase().includes(s));
  }, [all, query]);
  const total = list.reduce((s, t) => s + Number(t.amount), 0);

  const { spark, thisMonth, lastMonth, topCat, txCount } = useMemo(() => {
    const days = 14;
    const today = new Date();
    const buckets = new Array(days).fill(0);
    for (const t of all) {
      const d = new Date(t.occurred_on);
      const diff = Math.floor((+today - +d) / 86400000);
      if (diff >= 0 && diff < days) buckets[days - 1 - diff] += Number(t.amount);
    }
    const ym = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
    const tm = ym(today);
    const lm = ym(new Date(today.getFullYear(), today.getMonth() - 1, 1));
    let tmSum = 0, lmSum = 0;
    const catMap: Record<string, number> = {};
    for (const t of all) {
      const d = new Date(t.occurred_on);
      if (ym(d) === tm) tmSum += Number(t.amount);
      if (ym(d) === lm) lmSum += Number(t.amount);
      catMap[t.category] = (catMap[t.category] ?? 0) + Number(t.amount);
    }
    const top = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
    return { spark: buckets, thisMonth: tmSum, lastMonth: lmSum, topCat: top, txCount: all.length };
  }, [all]);

  const momPct = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : (thisMonth > 0 ? 100 : 0);

  const remove = async (id: string) => {
    if (!confirm(t("মুছে ফেলবেন?", "Delete this?"))) return;
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
    <AppShell title={t("আয়", "Income")} actions={
      <div className="flex items-center gap-2">
        <button onClick={() => setCatOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm">
          <Tags className="w-4 h-4" /> {t("ক্যাটাগরি", "Categories")}
        </button>
        <button onClick={openNew} className="group flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg text-sm font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.02] transition-all">
          <Plus className="w-4 h-4" /> {t("নতুন আয়", "New income")}
        </button>
      </div>
    }>
      {/* Hero summary */}
      <div className="relative overflow-hidden rounded-2xl p-5 sm:p-7 mb-5 text-white shadow-2xl shadow-emerald-500/30"
        style={{ background: "linear-gradient(135deg,#059669 0%,#10b981 45%,#14b8a6 100%)" }}>
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-teal-300/20 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-emerald-50/90 text-xs font-medium tracking-wider uppercase mb-2">
              <Sparkles className="w-3.5 h-3.5" /> {t("মোট আয়", "Total income")}
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight drop-shadow-sm">{fmtTk(total)}</div>
            <div className="flex flex-wrap items-center gap-3 mt-3 text-sm">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
                <ArrowUpRight className={`w-3.5 h-3.5 ${momPct >= 0 ? "" : "rotate-180"}`} />
                <span className="font-semibold">{momPct >= 0 ? "+" : ""}{toBn(momPct.toFixed(1))}%</span>
                <span className="text-emerald-50/80 text-xs">{t("গত মাসের তুলনায়", "vs last month")}</span>
              </span>
              <span className="text-emerald-50/80 text-xs">{t("মোট লেনদেন", "Total transactions")}: <b className="text-white">{toBn(txCount)}</b></span>
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <div className="text-[11px] uppercase tracking-wider text-emerald-50/80">{t("শেষ ১৪ দিন", "Last 14 days")}</div>
            <Sparkline points={spark} />
          </div>
        </div>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-5">
        <div className="group relative overflow-hidden bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{t("এই মাস", "This month")}</div>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center"><Calendar className="w-4 h-4 text-emerald-600" /></div>
          </div>
          <div className="text-xl font-extrabold text-slate-800 mt-1">{fmtTk(thisMonth)}</div>
        </div>
        <div className="group relative overflow-hidden bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-indigo-400" />
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{t("গত মাস", "Last month")}</div>
            <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center"><TrendingUp className="w-4 h-4 text-sky-600" /></div>
          </div>
          <div className="text-xl font-extrabold text-slate-800 mt-1">{fmtTk(lastMonth)}</div>
        </div>
        <div className="col-span-2 lg:col-span-1 group relative overflow-hidden bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{t("শীর্ষ উৎস", "Top source")}</div>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center"><Wallet className="w-4 h-4 text-amber-600" /></div>
          </div>
          <div className="text-base font-bold text-slate-800 mt-1 truncate">{topCat?.[0] ?? "—"}</div>
          {topCat && <div className="text-xs text-slate-500 font-medium">{fmtTk(topCat[1])}</div>}
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("ক্যাটাগরি বা নোট খুঁজুন...", "Search category or note...")}
            className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"/></svg>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-600">
          <span className="text-slate-400">{t("দেখাচ্ছে", "Showing")}:</span> <b>{toBn(list.length)}</b>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-r from-slate-50 to-emerald-50/40 text-slate-600 text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider">{t("ক্যাটাগরি", "Category")}</th>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider">{t("নোট", "Note")}</th>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider">{t("তারিখ", "Date")}</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wider">{t("পরিমাণ", "Amount")}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={5} className="text-center text-slate-400 py-8">{t("লোড হচ্ছে...", "Loading...")}</td></tr>}
            {!q.isLoading && list.length === 0 && (
              <tr><td colSpan={5} className="text-center py-12">
                <div className="inline-flex flex-col items-center gap-2">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center"><Wallet className="w-7 h-7 text-emerald-600" /></div>
                  <div className="text-slate-500 text-sm">{query ? t("কিছু পাওয়া যায়নি", "No matches") : t("কোনো আয় নেই", "No income yet")}</div>
                </div>
              </td></tr>
            )}
            {list.map((t) => (
              <tr key={t.id} className="group border-t border-slate-100 hover:bg-emerald-50/30 transition-colors">
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 ring-2 ring-emerald-100" />
                    <span className="font-medium text-slate-700">{t.category}</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{t.note || "—"}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{toBn(t.occurred_on)}</td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                    +{fmtTk(Number(t.amount))}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(t)} className="p-1.5 rounded-md hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 transition-colors" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(t.id)} className="p-1.5 rounded-md hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-colors" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TxnDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }} editTxn={editing} />
      <CategoryManager open={catOpen} onOpenChange={setCatOpen} type="income" />
    </AppShell>
  );
}