import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { fmtTk, toBn } from "@/lib/finance";
import { Plus, Trash2, Target, Pencil, ListFilter } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/hooks/useLanguage";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";

export const Route = createFileRoute("/_authenticated/goals")({ component: GoalsPage });

type Goal = { id: string; label: string; target: number; current: number; deadline: string | null; color: string; status: "pending" | "ongoing" | "completed" | null };

const COLORS = [
  { key: "emerald", bg: "bg-emerald-500", text: "text-emerald-600", soft: "bg-emerald-50" },
  { key: "blue", bg: "bg-blue-500", text: "text-blue-600", soft: "bg-blue-50" },
  { key: "orange", bg: "bg-orange-500", text: "text-orange-600", soft: "bg-orange-50" },
  { key: "rose", bg: "bg-rose-500", text: "text-rose-600", soft: "bg-rose-50" },
  { key: "indigo", bg: "bg-indigo-500", text: "text-indigo-600", soft: "bg-indigo-50" },
];
const colorOf = (k: string) => COLORS.find((c) => c.key === k) ?? COLORS[0];

function GoalsPage() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const uid = useCurrentUserId();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Goal | null>(null);
  const [form, setForm] = useState({ label: "", target: "", current: "", deadline: "", color: "emerald" });
  const [filter, setFilter] = useState<"all" | "pending" | "ongoing" | "completed">("all");

  const q = useQuery({
    queryKey: ["goals", uid],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("id,label,target,current,deadline,color,status").eq("user_id", uid).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Goal[];
    },
  });

  const openNew = () => { setEdit(null); setForm({ label: "", target: "", current: "", deadline: "", color: "emerald" }); setOpen(true); };
  const openEdit = (g: Goal) => { setEdit(g); setForm({ label: g.label, target: String(g.target), current: String(g.current), deadline: g.deadline ?? "", color: g.color }); setOpen(true); };

  const save = async () => {
    if (!form.label.trim() || !form.target) { toast.error(t("নাম ও লক্ষ্য পরিমাণ দিন", "Enter name and target amount")); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = {
      label: form.label.trim(),
      target: parseFloat(form.target),
      current: parseFloat(form.current || "0"),
      deadline: form.deadline || null,
      color: form.color,
    };
    const { error } = edit
      ? await supabase.from("goals").update(payload).eq("id", edit.id).eq("user_id", uid)
      : await supabase.from("goals").insert({ ...payload, user_id: user.id });
    if (error) { toast.error(error.message); return; }
    toast.success(t("সংরক্ষিত", "Saved"));
    qc.invalidateQueries({ queryKey: ["goals"] });
    setOpen(false);
  };
  const remove = async (id: string) => {
    if (!confirm(t("লক্ষ্যটি মুছে ফেলবেন?", "Delete this goal?"))) return;
    const { error } = await supabase.from("goals").delete().eq("id", id).eq("user_id", uid);
    if (error) { toast.error(error.message); return; }
    toast.success(t("মুছে ফেলা হয়েছে", "Deleted"));
    qc.invalidateQueries({ queryKey: ["goals"] });
  };

  const list = q.data ?? [];
  const autoStatus = (g: Goal): "pending" | "ongoing" | "completed" => {
    const c = Number(g.current), tg = Number(g.target);
    return c >= tg ? "completed" : c > 0 ? "ongoing" : "pending";
  };
  const effStatus = (g: Goal) => g.status ?? autoStatus(g);

  const setStatus = async (g: Goal, s: "pending" | "ongoing" | "completed") => {
    const next = effStatus(g) === s ? null : s;
    const { error } = await supabase.from("goals").update({ status: next }).eq("id", g.id).eq("user_id", uid);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["goals"] });
  };

  const filteredList = useMemo(() => {
    if (filter === "all") return list;
    return list.filter((g) => effStatus(g) === filter);
  }, [list, filter]);

  const filterBtns: { key: typeof filter; labelBn: string; labelEn: string }[] = [
    { key: "all", labelBn: "পতিটি বিষয়", labelEn: "All" },
    { key: "pending", labelBn: "অপেক্ষিত", labelEn: "Pending" },
    { key: "ongoing", labelBn: "চলমান", labelEn: "Ongoing" },
    { key: "completed", labelBn: "শেষ", labelEn: "Completed" },
  ];

  return (
    <AppShell title={t("সঞ্চয় লক্ষ্য", "Savings goals")} actions={
      <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
        <Plus className="w-4 h-4" /> {t("নতুন লক্ষ্য", "New goal")}
      </button>
    }>
      {q.isLoading && <div className="text-slate-400">{t("লোড হচ্ছে...", "Loading...")}</div>}
      {!q.isLoading && list.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          <Target className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          {t('এখনো কোনো লক্ষ্য নেই। "নতুন লক্ষ্য" দিয়ে শুরু করুন।', 'No goals yet. Start with "New goal".')}
        </div>
      )}

      {/* Filter tabs */}
      {list.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mr-1">
            <ListFilter className="w-3.5 h-3.5" />
            <span>{t("ফিল্টার", "Filter")}:</span>
          </div>
          {filterBtns.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === f.key
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {t(f.labelBn, f.labelEn)}
            </button>
          ))}
        </div>
      )}

      {filteredList.length === 0 && list.length > 0 && (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
          <Target className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          {t("এই ফিল্টারে কোনো লক্ষ্য পাওয়া যায়নি", "No goals match this filter")}
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredList.map((g) => {
          const c = colorOf(g.color);
          const pct = g.target > 0 ? Math.min(100, (Number(g.current) / Number(g.target)) * 100) : 0;
          const status = effStatus(g);
          const statusBtns: { key: "pending" | "ongoing" | "completed"; labelBn: string; labelEn: string; active: string }[] = [
            { key: "pending", labelBn: "অপেক্ষিত", labelEn: "Pending", active: "bg-amber-500 text-white border-amber-500" },
            { key: "ongoing", labelBn: "চলমান", labelEn: "Ongoing", active: "bg-emerald-500 text-white border-emerald-500" },
            { key: "completed", labelBn: "শেষ", labelEn: "Completed", active: "bg-slate-500 text-white border-slate-500" },
          ];
          return (
            <div key={g.id} className="bg-white rounded-xl p-5 border border-slate-200">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-full ${c.soft} flex items-center justify-center`}>
                  <Target className={`w-5 h-5 ${c.text}`} />
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(g)} className="p-1.5 rounded-md hover:bg-slate-50 text-slate-400 hover:text-slate-700"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(g.id)} className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="font-bold text-slate-800 mb-1">{g.label}</div>
              <div className="text-xs text-slate-500 mb-3">{fmtTk(Number(g.current))} / {fmtTk(Number(g.target))}</div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {statusBtns.map((sb) => (
                  <button
                    key={sb.key}
                    onClick={() => setStatus(g, sb.key)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                      status === sb.key
                        ? sb.active
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {t(sb.labelBn, sb.labelEn)}
                  </button>
                ))}
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-1">
                <div className={`h-full ${c.bg}`} style={{ width: `${pct}%` }}></div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className={c.text}>{toBn(pct.toFixed(0))}%</span>
                {g.deadline && <span className="text-slate-400">{t("শেষ", "Due")}: {toBn(g.deadline)}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? t("লক্ষ্য এডিট", "Edit goal") : t("নতুন লক্ষ্য", "New goal")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder={t("লক্ষ্যের নাম", "Goal name")} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder={t("লক্ষ্য ৳", "Target ৳")} className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              <input type="number" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} placeholder={t("বর্তমান ৳", "Current ৳")} className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button key={c.key} onClick={() => setForm({ ...form, color: c.key })} className={`w-8 h-8 rounded-full ${c.bg} ${form.color === c.key ? "ring-2 ring-offset-2 ring-slate-400" : ""}`}></button>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setOpen(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">{t("বাতিল", "Cancel")}</button>
              <button onClick={save} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm">{t("সেভ", "Save")}</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}