import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { TxnDialog, type EditTxn } from "@/components/dashboard/TxnDialog";
import { CategoryManager } from "@/components/dashboard/CategoryManager";
import { SalaryAllocator } from "@/components/dashboard/SalaryAllocator";
import { fmtTk, toBn } from "@/lib/finance";
import { Plus, Trash2, TrendingDown, Pencil, Tags } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/expense")({ component: ExpensePage });

type Txn = { id: string; type: "income" | "expense"; category: string; amount: number; occurred_on: string; note: string | null };

function ExpensePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EditTxn | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const q = useQuery({
    queryKey: ["transactions", "expense"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("id,type,category,amount,occurred_on,note").eq("type", "expense").order("occurred_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Txn[];
    },
  });
  const list = q.data ?? [];
  const total = list.reduce((s, t) => s + Number(t.amount), 0);
  const remove = async (id: string) => {
    if (!confirm("মুছে ফেলবেন?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("মুছে ফেলা হয়েছে");
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };
  const openEdit = (t: Txn) => {
    setEditing({ id: t.id, type: t.type, category: t.category, amount: Number(t.amount), occurred_on: t.occurred_on, note: t.note });
    setOpen(true);
  };
  const openNew = () => { setEditing(null); setOpen(true); };

  return (
    <AppShell title="ব্যয়" actions={
      <div className="flex items-center gap-2">
        <button onClick={() => setCatOpen(true)} className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
          <Tags className="w-4 h-4" /> ক্যাটাগরি
        </button>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-medium hover:bg-rose-600">
          <Plus className="w-4 h-4" /> নতুন ব্যয়
        </button>
      </div>
    }>
      <div className="bg-white rounded-xl p-5 border border-slate-200 mb-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center">
          <TrendingDown className="w-6 h-6 text-rose-500" />
        </div>
        <div>
          <div className="text-sm text-slate-500">মোট ব্যয়</div>
          <div className="text-2xl font-bold text-rose-500">{fmtTk(total)}</div>
        </div>
      </div>
      <SalaryAllocator />
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-medium">ক্যাটাগরি</th>
              <th className="text-left px-4 py-3 font-medium">নোট</th>
              <th className="text-left px-4 py-3 font-medium">তারিখ</th>
              <th className="text-right px-4 py-3 font-medium">পরিমাণ</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={5} className="text-center text-slate-400 py-8">লোড হচ্ছে...</td></tr>}
            {!q.isLoading && list.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-8">কোনো ব্যয় নেই</td></tr>}
            {list.map((t) => (
              <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">{t.category}</td>
                <td className="px-4 py-3 text-slate-600">{t.note || "—"}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{toBn(t.occurred_on)}</td>
                <td className="px-4 py-3 text-right font-bold text-rose-500">{fmtTk(Number(t.amount))}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(t)} className="p-1.5 rounded-md hover:bg-indigo-50 text-slate-400 hover:text-indigo-600" title="এডিট">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(t.id)} className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600" title="মুছুন">
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
      <CategoryManager open={catOpen} onOpenChange={setCatOpen} type="expense" />
    </AppShell>
  );
}