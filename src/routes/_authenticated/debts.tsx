import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { fmtTk, toBn } from "@/lib/finance";
import { Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/debts")({ component: DebtsPage });

type Debt = { id: string; kind: "receivable" | "payable"; amount: number; person: string; note: string | null; due_date: string | null; settled: boolean };

function DebtsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: "receivable" as "receivable" | "payable", person: "", amount: "", due_date: "", note: "" });

  const q = useQuery({
    queryKey: ["debts", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("debts").select("id,kind,amount,person,note,due_date,settled").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Debt[];
    },
  });
  const list = q.data ?? [];
  const receivable = list.filter((d) => d.kind === "receivable" && !d.settled).reduce((s, d) => s + Number(d.amount), 0);
  const payable = list.filter((d) => d.kind === "payable" && !d.settled).reduce((s, d) => s + Number(d.amount), 0);

  const save = async () => {
    if (!form.person.trim() || !form.amount) { toast.error("ব্যক্তি ও পরিমাণ দিন"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("debts").insert({
      user_id: user.id, kind: form.kind, person: form.person.trim(),
      amount: parseFloat(form.amount), due_date: form.due_date || null, note: form.note || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("যোগ হয়েছে");
    qc.invalidateQueries({ queryKey: ["debts"] });
    setOpen(false);
    setForm({ kind: "receivable", person: "", amount: "", due_date: "", note: "" });
  };
  const toggle = async (d: Debt) => {
    const { error } = await supabase.from("debts").update({ settled: !d.settled }).eq("id", d.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["debts"] });
  };
  const remove = async (id: string) => {
    if (!confirm("মুছে ফেলবেন?")) return;
    const { error } = await supabase.from("debts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("মুছে ফেলা হয়েছে");
    qc.invalidateQueries({ queryKey: ["debts"] });
  };

  return (
    <AppShell title="পাওনা / দেনা" actions={
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
        <Plus className="w-4 h-4" /> নতুন
      </button>
    }>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="text-sm text-slate-500">মোট পাওনা</div>
          <div className="text-2xl font-bold text-emerald-600">{fmtTk(receivable)}</div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="text-sm text-slate-500">মোট দেনা</div>
          <div className="text-2xl font-bold text-rose-500">{fmtTk(payable)}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-medium">ধরন</th>
              <th className="text-left px-4 py-3 font-medium">ব্যক্তি</th>
              <th className="text-left px-4 py-3 font-medium">নোট</th>
              <th className="text-left px-4 py-3 font-medium">তারিখ</th>
              <th className="text-right px-4 py-3 font-medium">পরিমাণ</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={6} className="text-center text-slate-400 py-8">লোড হচ্ছে...</td></tr>}
            {!q.isLoading && list.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-8">কোনো রেকর্ড নেই</td></tr>}
            {list.map((d) => (
              <tr key={d.id} className={`border-t border-slate-100 hover:bg-slate-50 ${d.settled ? "opacity-50" : ""}`}>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${d.kind === "receivable" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`}>
                    {d.kind === "receivable" ? "পাওনা" : "দেনা"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">{d.person}</td>
                <td className="px-4 py-3 text-slate-600">{d.note || "—"}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{d.due_date ? toBn(d.due_date) : "—"}</td>
                <td className={`px-4 py-3 text-right font-bold ${d.kind === "receivable" ? "text-emerald-600" : "text-rose-500"}`}>{fmtTk(Number(d.amount))}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => toggle(d)} title={d.settled ? "আবার সক্রিয়" : "পরিশোধিত"} className={`p-1.5 rounded-md hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 ${d.settled ? "text-emerald-600" : ""}`}><Check className="w-4 h-4" /></button>
                    <button onClick={() => remove(d.id)} className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>নতুন পাওনা/দেনা</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setForm({ ...form, kind: "receivable" })} className={`py-2 rounded-lg border text-sm font-medium ${form.kind === "receivable" ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "border-slate-200 text-slate-600"}`}>পাওনা</button>
              <button onClick={() => setForm({ ...form, kind: "payable" })} className={`py-2 rounded-lg border text-sm font-medium ${form.kind === "payable" ? "bg-rose-50 border-rose-300 text-rose-700" : "border-slate-200 text-slate-600"}`}>দেনা</button>
            </div>
            <input value={form.person} onChange={(e) => setForm({ ...form, person: e.target.value })} placeholder="ব্যক্তির নাম" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="পরিমাণ ৳" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="নোট (ঐচ্ছিক)" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            <div className="flex gap-2 pt-2">
              <button onClick={() => setOpen(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">বাতিল</button>
              <button onClick={save} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm">সেভ</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}