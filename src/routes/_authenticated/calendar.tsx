import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { fmtTk, toBn, BN_MONTHS } from "@/lib/finance";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2 } from "lucide-react";
import { TxnDialog, type EditTxn } from "@/components/dashboard/TxnDialog";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";

export const Route = createFileRoute("/_authenticated/calendar")({ component: CalendarPage });

type Txn = { id: string; type: "income" | "expense"; amount: number; occurred_on: string; category: string; note: string | null };

const BN_DAYS = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];
const EN_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CalendarPage() {
  const { t, lang } = useLanguage();
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selected, setSelected] = useState<string | null>(null);
  const [txnOpen, setTxnOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<EditTxn | null>(null);

  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const startISO = new Date(y, m, 1).toISOString().slice(0, 10);
  const endISO = new Date(y, m + 1, 1).toISOString().slice(0, 10);

  const q = useQuery({
    queryKey: ["transactions", "month", startISO],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("id,type,amount,occurred_on,category,note").gte("occurred_on", startISO).lt("occurred_on", endISO);
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
    const { error } = await supabase.from("transactions").delete().eq("id", id);
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
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {(lang === "bn" ? BN_DAYS : EN_DAYS).map((d) => <div key={d} className="text-center text-xs font-medium text-slate-500 py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i}></div>;
              const iso = isoOf(d);
              const info = dayMap.get(iso);
              const isToday = iso === today;
              const isSel = iso === selected;
              return (
                <button key={i} onClick={() => setSelected(iso)} className={`aspect-square p-1.5 rounded-lg border text-left transition ${isSel ? "border-indigo-500 bg-indigo-50" : isToday ? "border-indigo-200 bg-indigo-50/40" : "border-slate-100 hover:border-slate-300"}`}>
                  <div className={`text-xs font-medium ${isToday ? "text-indigo-600" : "text-slate-700"}`}>{toBn(d)}</div>
                  {info && (
                    <div className="mt-1 space-y-0.5">
                      {info.inc > 0 && <div className="text-[10px] text-emerald-600 truncate">+{toBn(Math.round(info.inc))}</div>}
                      {info.exp > 0 && <div className="text-[10px] text-rose-500 truncate">-{toBn(Math.round(info.exp))}</div>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-sm font-bold text-slate-800 mb-3">{selected ? toBn(selected) : t("তারিখ নির্বাচন করুন", "Select a date")}</div>
          {selData ? (
            <>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="p-2 bg-emerald-50 rounded-lg"><div className="text-[10px] text-slate-500">{t("আয়", "Income")}</div><div className="text-sm font-bold text-emerald-600">{fmtTk(selData.inc)}</div></div>
                <div className="p-2 bg-rose-50 rounded-lg"><div className="text-[10px] text-slate-500">{t("ব্যয়", "Expense")}</div><div className="text-sm font-bold text-rose-500">{fmtTk(selData.exp)}</div></div>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selData.items.map((tx, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-sm border-b border-slate-100 pb-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-slate-700">{tx.category}</div>
                      {tx.note && <div className="text-xs text-slate-400">{tx.note}</div>}
                    </div>
                    <div className={tx.type === "income" ? "text-emerald-600 font-bold" : "text-rose-500 font-bold"}>
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
            <div className="text-xs text-slate-400 py-8 text-center">{t("কোনো তারিখ এ ক্লিক করে দিনের লেনদেন দেখুন", "Click a date to see transactions")}</div>
          )}
        </div>
      </div>
      <TxnDialog open={txnOpen} onOpenChange={(v) => { setTxnOpen(v); if (!v) setEditingTxn(null); }} editTxn={editingTxn} />
    </AppShell>
  );
}