import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { fmtTk, toBn, BN_MONTHS } from "@/lib/finance";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, CalendarDays, TrendingUp, TrendingDown, PiggyBank } from "lucide-react";
import { TxnDialog, type EditTxn } from "@/components/dashboard/TxnDialog";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";

export const Route = createFileRoute("/_authenticated/calendar")({ component: CalendarPage });

type Txn = { id: string; type: "income" | "expense"; amount: number; occurred_on: string; category: string; note: string | null };

const BN_DAYS = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];
const EN_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CalendarPage() {
  const { t, lang } = useLanguage();
  const qc = useQueryClient();
  const uid = useCurrentUserId();
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selected, setSelected] = useState<string | null>(null);
  const [txnOpen, setTxnOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<EditTxn | null>(null);

  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const startISO = new Date(y, m, 1).toISOString().slice(0, 10);
  const endISO = new Date(y, m + 1, 1).toISOString().slice(0, 10);

  const q = useQuery({
    queryKey: ["transactions", "month", uid, startISO],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("id,type,amount,occurred_on,category,note").eq("user_id", uid).gte("occurred_on", startISO).lt("occurred_on", endISO);
      if (error) throw error;
      return (data ?? []) as Txn[];
    },
  });
  const list = q.data ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };
  const remove = async (id: string) => {
    if (!confirm(t("লেনদেনটি মুছে ফেলবেন?", "Delete this transaction?"))) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id).eq("user_id", uid);
    if (error) { toast.error(error.message); return; }
    toast.success(t("মুছে ফেলা হয়েছে", "Deleted"));
    refresh();
  };
  const openNew = () => {
    setEditingTxn(null);
    setTxnOpen(true);
  };
  const openEdit = (t: Txn) => {
    setEditingTxn({ id: t.id, type: t.type, category: t.category, amount: Number(t.amount), occurred_on: t.occurred_on, note: t.note });
    setTxnOpen(true);
  };

  const dayMap = useMemo(() => {
    const map = new Map<string, { inc: number; exp: number; items: Txn[] }>();
    list.forEach((t) => {
      const cur = map.get(t.occurred_on) ?? { inc: 0, exp: 0, items: [] };
      if (t.type === "income") cur.inc += Number(t.amount); else cur.exp += Number(t.amount);
      cur.items.push(t);
      map.set(t.occurred_on, cur);
    });
    return map;
  }, [list]);

  const firstWeekday = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isoOf = (d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const today = new Date().toISOString().slice(0, 10);
  const selData = selected ? dayMap.get(selected) : null;

  const monthTotals = useMemo(() => {
    let inc = 0, exp = 0;
    list.forEach((t) => { if (t.type === "income") inc += Number(t.amount); else exp += Number(t.amount); });
    return { inc, exp, net: inc - exp, count: list.length };
  }, [list]);

  return (
    <AppShell title={t("ক্যালেন্ডার", "Calendar")} actions={
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200">
          <button onClick={() => { const d = new Date(cursor); d.setMonth(d.getMonth() - 1); setCursor(d); }}><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
          <span className="text-sm font-medium text-slate-700 min-w-[120px] text-center">{BN_MONTHS[m]} {toBn(y)}</span>
          <button onClick={() => { const d = new Date(cursor); d.setMonth(d.getMonth() + 1); setCursor(d); }}><ChevronRight className="w-4 h-4 text-slate-500" /></button>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> {t("নতুন লেনদেন", "New transaction")}
        </button>
      </div>
    }>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl p-5 sm:p-6 mb-4 text-white shadow-xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-rose-500">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-16 w-72 h-72 bg-fuchsia-300/20 rounded-full blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white/15 backdrop-blur rounded-full text-xs font-medium mb-2">
              <CalendarDays className="w-3.5 h-3.5" /> {BN_MONTHS[m]} {toBn(y)}
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{t("মাসিক ক্যালেন্ডার", "Monthly calendar")}</h2>
            <p className="text-white/80 text-sm mt-1">{toBn(monthTotals.count)} {t("টি লেনদেন", "transactions")}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-200" /><div><div className="text-[10px] uppercase tracking-wider text-white/70">{t("আয়", "Income")}</div><div className="text-base sm:text-xl font-bold">{fmtTk(monthTotals.inc)}</div></div></div>
            <div className="flex items-center gap-2"><TrendingDown className="w-4 h-4 text-rose-200" /><div><div className="text-[10px] uppercase tracking-wider text-white/70">{t("ব্যয়", "Expense")}</div><div className="text-base sm:text-xl font-bold">{fmtTk(monthTotals.exp)}</div></div></div>
            <div className="flex items-center gap-2"><PiggyBank className="w-4 h-4 text-sky-200" /><div><div className="text-[10px] uppercase tracking-wider text-white/70">{t("নিট", "Net")}</div><div className="text-base sm:text-xl font-bold">{fmtTk(monthTotals.net)}</div></div></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-x-auto">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {(lang === "bn" ? BN_DAYS : EN_DAYS).map((d, i) => (
              <div key={d} className={`text-center text-xs font-bold py-2 ${i === 0 || i === 6 ? "text-rose-500" : "text-slate-500"}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((d, i) => {
              if (!d) return <div key={i}></div>;
              const iso = isoOf(d);
              const info = dayMap.get(iso);
              const isToday = iso === today;
              const isSel = iso === selected;
              const hasData = !!info && (info.inc > 0 || info.exp > 0);
              const dominant = info ? (info.inc >= info.exp ? "inc" : "exp") : null;
              return (
                <button key={i} onClick={() => setSelected(iso)}
                  className={`relative aspect-square p-1.5 rounded-xl border text-left transition-all hover:-translate-y-0.5 hover:shadow-md
                    ${isSel
                      ? "border-transparent bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-200"
                      : isToday
                        ? "border-indigo-300 bg-gradient-to-br from-indigo-50 to-violet-50 ring-2 ring-indigo-200"
                        : hasData
                          ? `border-slate-200 bg-gradient-to-br ${dominant === "inc" ? "from-emerald-50/60 to-white" : "from-rose-50/60 to-white"} hover:border-indigo-300`
                          : "border-slate-100 hover:border-slate-300 bg-white"}`}>
                  <div className={`text-xs font-bold ${isSel ? "text-white" : isToday ? "text-indigo-700" : "text-slate-700"}`}>{toBn(d)}</div>
                  {info && (
                    <div className="mt-1 space-y-0.5">
                      {info.inc > 0 && <div className={`text-[10px] font-semibold truncate ${isSel ? "text-emerald-100" : "text-emerald-600"}`}>+{toBn(Math.round(info.inc))}</div>}
                      {info.exp > 0 && <div className={`text-[10px] font-semibold truncate ${isSel ? "text-rose-100" : "text-rose-500"}`}>-{toBn(Math.round(info.exp))}</div>}
                    </div>
                  )}
                  {hasData && !isSel && (
                    <div className="absolute bottom-1 right-1 flex gap-0.5">
                      {info!.inc > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      {info!.exp > 0 && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
            {selected ? toBn(selected) : t("তারিখ নির্বাচন করুন", "Select a date")}
          </div>
          {selData ? (
            <>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-200">
                  <div className="text-[10px] uppercase tracking-wider text-white/80">{t("আয়", "Income")}</div>
                  <div className="text-sm font-extrabold">{fmtTk(selData.inc)}</div>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-md shadow-rose-200">
                  <div className="text-[10px] uppercase tracking-wider text-white/80">{t("ব্যয়", "Expense")}</div>
                  <div className="text-sm font-extrabold">{fmtTk(selData.exp)}</div>
                </div>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selData.items.map((tx, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-sm rounded-lg p-2 hover:bg-slate-50 border-l-2 transition" style={{ borderColor: tx.type === "income" ? "#10b981" : "#f43f5e" }}>
                    <div className="min-w-0 flex-1">
                      <div className="text-slate-700 font-medium">{tx.category}</div>
                      {tx.note && <div className="text-xs text-slate-400">{tx.note}</div>}
                    </div>
                    <div className={tx.type === "income" ? "text-emerald-600 font-extrabold" : "text-rose-500 font-extrabold"}>
                      {tx.type === "income" ? "+" : "-"}{fmtTk(Number(tx.amount))}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(tx)} title={t("এডিট", "Edit")} className="p-1 rounded hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => remove(tx.id)} title={t("মুছুন", "Delete")} className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-400 py-12 text-center">
              <CalendarDays className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              {t("কোনো তারিখ এ ক্লিক করে দিনের লেনদেন দেখুন", "Click a date to see transactions")}
            </div>
          )}
        </div>
      </div>
      <TxnDialog open={txnOpen} onOpenChange={(v) => { setTxnOpen(v); if (!v) setEditingTxn(null); }} editTxn={editingTxn} />
    </AppShell>
  );
}