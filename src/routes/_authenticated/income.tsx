import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { TxnDialog } from "@/components/dashboard/TxnDialog";
import { fmtTk, toBn } from "@/lib/finance";
import { Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/income")({ component: IncomePage });

type Txn = { id: string; type: "income" | "expense"; category: string; amount: number; occurred_on: string; note: string | null };

function IncomePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["transactions", "income"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("id,type,category,amount,occurred_on,note").eq("type", "income").order("occurred_on", { ascending: false });
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

  return (
    <AppShell title="আয়" actions={
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
        <Plus className="w-4 h-4" /> নতুন আয়
      </button>
    }>
      <div className="bg-white rounded-xl p-5 border border-slate-200 mb-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
          <Wallet className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
          <div className="text-sm text-slate-500">মোট আয়</div>
          <div className="text-2xl font-bold text-emerald-600">{fmtTk(total)}</div>
        </div>
      </div>
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
            {!q.isLoading && list.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-8">কোনো আয় নেই</td></tr>}
            {list.map((t) => (
              <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">{t.category}</td>
                <td className="px-4 py-3 text-slate-600">{t.note || "—"}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{toBn(t.occurred_on)}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-600">{fmtTk(Number(t.amount))}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(t.id)} className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TxnDialog open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}