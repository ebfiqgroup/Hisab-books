import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { TxnDialog, type EditTxn } from "@/components/dashboard/TxnDialog";
import { CategoryManager } from "@/components/dashboard/CategoryManager";
import { fmtTk, toBn } from "@/lib/finance";
import { useCustomCategories } from "@/hooks/useCustomCategories";
import { useMemo } from "react";
import { Plus, Trash2, TrendingDown, Pencil, Tags } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";

export const Route = createFileRoute("/_authenticated/expense")({ component: ExpensePage });

type Txn = { id: string; type: "income" | "expense"; category: string; amount: number; occurred_on: string; note: string | null };

function ExpensePage() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EditTxn | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const { forType } = useCustomCategories();
  const q = useQuery({
    queryKey: ["transactions", "expense"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("id,type,category,amount,occurred_on,note").eq("type", "expense").order("occurred_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Txn[];
    },
  });
  const allowed = useMemo(() => new Set(forType("expense")), [forType]);
  const list = useMemo(
    () => (q.data ?? []).filter((t) => allowed.has(t.category)),
    [q.data, allowed],
  );
  const total = list.reduce((s, t) => s + Number(t.amount), 0);
  const remove = async (id: string) => {
    if (!confirm(t("মুছে ফেলবেন?", "Delete this?"))) return;
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
    <AppShell title={t("ব্যয়", "Expense")} actions={
      <div className="flex items-center gap-2">
        <button onClick={() => setCatOpen(true)} className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
          <Tags className="w-4 h-4" /> <span className="hidden sm:inline">{t("ক্যাটাগরি", "Categories")}</span>
        </button>
        <button onClick={openNew} className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-medium hover:bg-rose-600">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">{t("নতুন ব্যয়", "New expense")}</span><span className="sm:hidden">{t("যোগ", "Add")}</span>
        </button>
      </div>
    }>
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 mb-4 flex items-center gap-3 sm:gap-4">
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
          <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-rose-500" />
        </div>
        <div className="min-w-0">
          <div className="text-sm text-slate-500">{t("মোট ব্যয়", "Total expense")}</div>
          <div className="text-xl sm:text-2xl font-bold text-rose-500 truncate">{fmtTk(total)}</div>
        </div>
      </div>
      {/* Desktop table */}
      <div className="hidden lg:block bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-slate-50 text-slate-600 text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-medium">{t("ক্যাটাগরি", "Category")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("নোট", "Note")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("তারিখ", "Date")}</th>
              <th className="text-right px-4 py-3 font-medium">{t("পরিমাণ", "Amount")}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={5} className="text-center text-slate-400 py-8">{t("লোড হচ্ছে...", "Loading...")}</td></tr>}
            {!q.isLoading && list.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-8">{t("কোনো ব্যয় নেই", "No expenses yet")}</td></tr>}
            {list.map((t) => (
              <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">{t.category}</td>
                <td className="px-4 py-3 text-slate-600">{t.note || "—"}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{toBn(t.occurred_on)}</td>
                <td className="px-4 py-3 text-right font-bold text-rose-500">{fmtTk(Number(t.amount))}</td>
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
            ))}
          </tbody>
        </table>
        </div>
      </div>
      {/* Mobile card list */}
      <div className="lg:hidden space-y-2">
        {q.isLoading && <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-400 text-sm">{t("লোড হচ্ছে...", "Loading...")}</div>}
        {!q.isLoading && list.length === 0 && <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-400 text-sm">{t("কোনো ব্যয় নেই", "No expenses yet")}</div>}
        {list.map((t) => (
          <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-slate-800 text-sm truncate">{t.category}</div>
                <div className="font-bold text-rose-500 text-sm whitespace-nowrap">{fmtTk(Number(t.amount))}</div>
              </div>
              {t.note && <div className="text-xs text-slate-600 mt-0.5 truncate">{t.note}</div>}
              <div className="text-[11px] text-slate-400 mt-1">{toBn(t.occurred_on)}</div>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <button onClick={() => openEdit(t)} className="p-1.5 rounded-md hover:bg-indigo-50 text-slate-400 hover:text-indigo-600" title="Edit">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => remove(t.id)} className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600" title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <TxnDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }} editTxn={editing} />
      <CategoryManager open={catOpen} onOpenChange={setCatOpen} type="expense" />
    </AppShell>
  );
}