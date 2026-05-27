import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { fmtTk, toBn } from "@/lib/finance";
import { Plus, Trash2, Target, Pencil, ListFilter, X, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/hooks/useLanguage";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";

export const Route = createFileRoute("/_authenticated/goals")({ component: GoalsPage });

type Goal = {
  id: string;
  label: string;
  target: number;
  current: number;
  start_date: string | null;
  deadline: string | null;
  color: string;
  category: string | null;
  status: "pending" | "ongoing" | "completed" | null;
};

const GOAL_CATS_LS_KEY = "goal_categories_v1";
const loadGoalCats = (): string[] => {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(GOAL_CATS_LS_KEY) || "[]") as string[]; } catch { return []; }
};
const saveGoalCats = (list: string[]) => {
  localStorage.setItem(GOAL_CATS_LS_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("goal_cats_changed"));
};

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
  const [form, setForm] = useState({ label: "", target: "", current: "", start_date: "", deadline: "", color: "emerald", category: "" });
  const [filter, setFilter] = useState<"all" | "pending" | "ongoing" | "completed">("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [cats, setCats] = useState<string[]>(() => loadGoalCats());
  const [newCat, setNewCat] = useState("");
  const [catManagerOpen, setCatManagerOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");

  useEffect(() => {
    const refresh = () => setCats(loadGoalCats());
    window.addEventListener("goal_cats_changed", refresh);
    return () => window.removeEventListener("goal_cats_changed", refresh);
  }, []);

  const addCategory = (raw: string) => {
    const name = raw.trim();
    if (!name) { toast.error(t("ক্যাটাগরির নাম দিন", "Enter category name")); return null; }
    const list = loadGoalCats();
    if (list.includes(name)) { toast.error(t("এই ক্যাটাগরি ইতোমধ্যে আছে", "Category already exists")); return name; }
    saveGoalCats([...list, name]);
    toast.success(t("ক্যাটাগরি যুক্ত হয়েছে", "Category added"));
    return name;
  };
  const removeCategory = (name: string) => {
    if (!confirm(t(`"${name}" ক্যাটাগরি মুছে ফেলবেন?`, `Delete category "${name}"?`))) return;
    saveGoalCats(loadGoalCats().filter((c) => c !== name));
    if (form.category === name) setForm({ ...form, category: "" });
    if (catFilter === name) setCatFilter("all");
  };

  const renameCategory = async (oldName: string, rawNew: string) => {
    const newName = rawNew.trim();
    if (!newName) { toast.error(t("নাম খালি হতে পারবে না", "Name cannot be empty")); return; }
    if (newName === oldName) { setEditingCat(null); return; }
    const list = loadGoalCats();
    if (list.includes(newName)) { toast.error(t("এই নাম ইতোমধ্যে আছে", "This name already exists")); return; }
    saveGoalCats(list.map((c) => (c === oldName ? newName : c)));
    const { error } = await supabase.from("goals").update({ category: newName }).eq("category", oldName).eq("user_id", uid);
    if (error) { toast.error(error.message); return; }
    if (form.category === oldName) setForm({ ...form, category: newName });
    if (catFilter === oldName) setCatFilter(newName);
    setEditingCat(null);
    toast.success(t("ক্যাটাগরি আপডেট হয়েছে", "Category updated"));
    qc.invalidateQueries({ queryKey: ["goals"] });
  };

  const q = useQuery({
    queryKey: ["goals", uid],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("id,label,target,current,start_date,deadline,color,category,status").eq("user_id", uid).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Goal[];
    },
  });

  // Auto-compute saved amount per goal category from income transactions
  const txAgg = useQuery({
    queryKey: ["transactions", "income-by-category", uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("category,amount,type,occurred_on")
        .eq("user_id", uid)
        .eq("type", "income");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of (data ?? []) as { category: string; amount: number }[]) {
        map[r.category] = (map[r.category] ?? 0) + Number(r.amount);
      }
      return map;
    },
  });
  const catSums = txAgg.data ?? {};
  const currentOf = (g: Goal) => {
    const stored = Number(g.current) || 0;
    if (g.category && catSums[g.category] != null) {
      return Math.max(stored, catSums[g.category]);
    }
    return stored;
  };

  const openNew = () => { setEdit(null); setForm({ label: "", target: "", current: "", start_date: "", deadline: "", color: "emerald", category: "" }); setOpen(true); };
  const openEdit = (g: Goal) => { setEdit(g); setForm({ label: g.label, target: String(g.target), current: String(g.current), start_date: g.start_date ?? "", deadline: g.deadline ?? "", color: g.color, category: g.category ?? "" }); setOpen(true); };

  const save = async () => {
    if (!form.label.trim() || !form.target) { toast.error(t("নাম ও লক্ষ্য পরিমাণ দিন", "Enter name and target amount")); return; }
    if (form.start_date && form.deadline && form.deadline < form.start_date) {
      toast.error(t("শেষ তারিখ শুরুর পরে হতে হবে", "End date must be after start date")); return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = {
      label: form.label.trim(),
      target: parseFloat(form.target),
      current: parseFloat(form.current || "0"),
      start_date: form.start_date || null,
      deadline: form.deadline || null,
      color: form.color,
      category: form.category || null,
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
    const c = currentOf(g), tg = Number(g.target);
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
    return list.filter((g) => {
      if (filter !== "all" && effStatus(g) !== filter) return false;
      if (catFilter !== "all" && (g.category ?? "") !== catFilter) return false;
      if (dateFrom) {
        const gEnd = g.deadline ?? g.start_date;
        if (gEnd && gEnd < dateFrom) return false;
      }
      if (dateTo) {
        const gStart = g.start_date ?? g.deadline;
        if (gStart && gStart > dateTo) return false;
      }
      return true;
    });
  }, [list, filter, catFilter, dateFrom, dateTo]);

  const filterBtns: { key: typeof filter; labelBn: string; labelEn: string }[] = [
    { key: "all", labelBn: "পতিটি বিষয়", labelEn: "All" },
    { key: "pending", labelBn: "অপেক্ষিত", labelEn: "Pending" },
    { key: "ongoing", labelBn: "চলমান", labelEn: "Ongoing" },
    { key: "completed", labelBn: "শেষ", labelEn: "Completed" },
  ];

  const totalTarget = filteredList.reduce((s, g) => s + Number(g.target), 0);
  const totalCurrent = filteredList.reduce((s, g) => s + currentOf(g), 0);
  const totalPct = totalTarget > 0 ? Math.min(100, (totalCurrent / totalTarget) * 100) : 0;
  const totalRemaining = Math.max(0, totalTarget - totalCurrent);
  const completedCount = filteredList.filter((g) => currentOf(g) >= Number(g.target) && Number(g.target) > 0).length;

  return (
    <AppShell title={t("সঞ্চয় লক্ষ্য", "Savings goals")} actions={
      <div className="flex items-center gap-2">
        <button onClick={() => setCatManagerOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
          <Plus className="w-4 h-4" /> {t("ক্যাটাগরি", "Category")}
        </button>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> {t("নতুন লক্ষ্য", "New goal")}
        </button>
      </div>
    }>
      {q.isLoading && <div className="text-slate-400">{t("লোড হচ্ছে...", "Loading...")}</div>}
      {!q.isLoading && list.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          <Target className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          {t('এখনো কোনো লক্ষ্য নেই। "নতুন লক্ষ্য" দিয়ে শুরু করুন।', 'No goals yet. Start with "New goal".')}
        </div>
      )}

      {/* Summary hero — total target / current */}
      {list.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl p-5 sm:p-6 mb-5 text-white shadow-2xl shadow-emerald-500/30"
          style={{ background: "linear-gradient(135deg,#059669 0%,#0d9488 50%,#0891b2 100%)" }}>
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/15 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center"><Target className="w-5 h-5" /></div>
              <div>
                <div className="text-[11px] uppercase tracking-wider font-semibold opacity-90">{t("মোট অর্জিত / মোট লক্ষ্য", "Total achieved / Total target")}</div>
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {fmtTk(totalCurrent)} <span className="opacity-70 text-base font-bold">/ {fmtTk(totalTarget)}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2.5 sm:p-3 border border-white/15">
                <div className="text-[10px] uppercase tracking-wider opacity-80 font-semibold">{t("বর্তমান", "Current")}</div>
                <div className="text-sm sm:text-lg font-extrabold tracking-tight tabular-nums">{fmtTk(totalCurrent)}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2.5 sm:p-3 border border-white/15">
                <div className="text-[10px] uppercase tracking-wider opacity-80 font-semibold">{t("বাকি", "Remaining")}</div>
                <div className="text-sm sm:text-lg font-extrabold tracking-tight tabular-nums">{fmtTk(totalRemaining)}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2.5 sm:p-3 border border-white/15">
                <div className="text-[10px] uppercase tracking-wider opacity-80 font-semibold">{t("পূর্ণ লক্ষ্য", "Completed")}</div>
                <div className="text-sm sm:text-lg font-extrabold tracking-tight tabular-nums">{toBn(completedCount)} / {toBn(filteredList.length)}</div>
              </div>
            </div>
            <div className="h-2.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
              <div className="h-full bg-white rounded-full shadow-lg transition-all" style={{ width: `${totalPct}%` }} />
            </div>
            <div className="flex justify-between text-xs mt-1.5 opacity-90 font-medium">
              <span>{toBn(totalPct.toFixed(1))}% {t("অর্জিত", "achieved")}</span>
              <span>{t("বাকি", "Remaining")}: {fmtTk(totalRemaining)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {list.length > 0 && (
        <div className="space-y-2 mb-4">
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mr-1">
              <ListFilter className="w-3.5 h-3.5" />
              <span>{t("স্ট্যাটাস", "Status")}:</span>
            </div>
            {filterBtns.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filter === f.key ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}>
                {t(f.labelBn, f.labelEn)}
              </button>
            ))}
          </div>
          {cats.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mr-1">
                <span>{t("ক্যাটাগরি", "Category")}:</span>
              </div>
              <button onClick={() => setCatFilter("all")}
                className={`px-3 py-1 rounded-full text-xs font-medium ${catFilter === "all" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
                {t("সব", "All")}
              </button>
              {cats.map((c) => (
                <button key={c} onClick={() => setCatFilter(c)}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${catFilter === c ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
                  {c}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mr-1">
              <CalendarClock className="w-3.5 h-3.5" />
              <span>{t("সময়", "Time")}:</span>
            </div>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded-md text-xs" />
            <span className="text-xs text-slate-400">→</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded-md text-xs" />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs text-slate-500 hover:text-slate-700 underline">
                {t("রিসেট", "Reset")}
              </button>
            )}
          </div>
        </div>
      )}

      {filteredList.length === 0 && list.length > 0 && (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
          <Target className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          {t("এই ফিল্টারে কোনো লক্ষ্য পাওয়া যায়নি", "No goals match this filter")}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredList.map((g) => {
          const c = colorOf(g.color);
          const curVal = currentOf(g);
          const pct = g.target > 0 ? Math.min(100, (curVal / Number(g.target)) * 100) : 0;
          const status = effStatus(g);
          const statusBtns: { key: "pending" | "ongoing" | "completed"; labelBn: string; labelEn: string; active: string }[] = [
            { key: "pending", labelBn: "অপেক্ষিত", labelEn: "Pending", active: "bg-amber-500 text-white border-amber-500" },
            { key: "ongoing", labelBn: "চলমান", labelEn: "Ongoing", active: "bg-emerald-500 text-white border-emerald-500" },
            { key: "completed", labelBn: "শেষ", labelEn: "Completed", active: "bg-slate-500 text-white border-slate-500" },
          ];
          const gradMap: Record<string, string> = {
            emerald: "linear-gradient(135deg,#059669,#10b981)",
            blue: "linear-gradient(135deg,#2563eb,#3b82f6)",
            orange: "linear-gradient(135deg,#ea580c,#f97316)",
            rose: "linear-gradient(135deg,#e11d48,#f43f5e)",
            indigo: "linear-gradient(135deg,#4f46e5,#7c3aed)",
          };
          const grad = gradMap[g.color] ?? gradMap.emerald;
          const completed = pct >= 100;
          return (
            <div key={g.id} className="group relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
              <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: grad }} />
              <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20 blur-2xl" style={{ background: grad }} />
              <div className="relative p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg" style={{ background: grad }}>
                  <Target className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-1">
                  {completed && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 ring-1 ring-amber-200">★ {t("পূর্ণ", "Done")}</span>}
                  <button onClick={() => openEdit(g)} className="p-1.5 rounded-md hover:bg-slate-50 text-slate-400 hover:text-slate-700"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(g.id)} className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="font-bold text-slate-800 mb-1 text-base">{g.label}</div>
              {g.category && <div className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 mb-1">{g.category}</div>}
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
              {/* Money progress */}
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-slate-500 font-medium">💰 {t("টাকা", "Money")}</span>
                <span className="text-slate-400">{t("বাকি", "Left")}: {fmtTk(Math.max(0, Number(g.target) - curVal))}</span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-1 shadow-inner">
                <div className="h-full rounded-full transition-all shadow-sm" style={{ width: `${pct}%`, background: grad }} />
              </div>
              <div className="text-[11px] mb-3">
                <span className="font-bold" style={{ color: pct >= 100 ? "#059669" : undefined }}>{toBn(pct.toFixed(0))}% {t("অর্জিত", "achieved")}</span>
              </div>

              {/* Time progress */}
              {(g.start_date || g.deadline) && (() => {
                const startMs = g.start_date ? new Date(g.start_date).getTime() : null;
                const endMs = g.deadline ? new Date(g.deadline).getTime() : null;
                const nowMs = Date.now();
                let timePct = 0;
                let remainingDays: number | null = null;
                if (startMs !== null && endMs !== null && endMs > startMs) {
                  timePct = Math.max(0, Math.min(100, ((nowMs - startMs) / (endMs - startMs)) * 100));
                  remainingDays = Math.max(0, Math.ceil((endMs - nowMs) / 86400000));
                } else if (endMs !== null) {
                  remainingDays = Math.max(0, Math.ceil((endMs - nowMs) / 86400000));
                  timePct = nowMs >= endMs ? 100 : 0;
                }
                const ahead = pct >= timePct + 1;
                const behind = pct < timePct - 1 && pct < 100;
                return (
                  <>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-slate-500 font-medium">⏱ {t("সময়", "Time")}</span>
                      <span className="text-slate-400">
                        {remainingDays !== null
                          ? remainingDays > 0 ? `${toBn(remainingDays)} ${t("দিন বাকি", "days left")}` : t("সময় শেষ", "Time up")
                          : "—"}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-1 shadow-inner">
                      <div className="h-full rounded-full transition-all bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${timePct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-amber-600">{toBn(timePct.toFixed(0))}% {t("সময় পার", "time passed")}</span>
                      {ahead ? <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-semibold">✓ {t("এগিয়ে", "Ahead")}</span>
                        : behind ? <span className="px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 font-semibold">⚠ {t("পিছিয়ে", "Behind")}</span>
                        : <span className="px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-500 font-semibold">{t("সঠিক গতি", "On track")}</span>}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-2">
                      <CalendarClock className="w-3 h-3" />
                      <span>{g.start_date ? toBn(g.start_date) : "—"} → {g.deadline ? toBn(g.deadline) : "—"}</span>
                    </div>
                  </>
                );
              })()}
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
              <div>
                <label className="block text-xs text-slate-600 mb-1">{t("মোট টাকা (৳)", "Total (৳)")}</label>
                <input type="number" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">{t("বর্তমান টাকা (৳)", "Current (৳)")}</label>
                <input type="number" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-600 mb-1">{t("শুরুর তারিখ", "Start date")}</label>
                <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">{t("শেষ তারিখ", "End date")}</label>
                <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">{t("ক্যাটাগরি", "Category")}</label>
              <div className="flex gap-2">
                <input type="text" value={newCat} onChange={(e) => setNewCat(e.target.value)}
                  placeholder={t("নতুন ক্যাটাগরির নাম", "New category name")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const added = addCategory(newCat);
                      if (added) { setForm({ ...form, category: added }); setNewCat(""); }
                    }
                  }}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                <button type="button" onClick={() => {
                  const added = addCategory(newCat);
                  if (added) { setForm({ ...form, category: added }); setNewCat(""); }
                }} className="px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> {t("যোগ", "Add")}
                </button>
              </div>
              {cats.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {cats.map((c) => {
                    const isEditing = editingCat === c;
                    const isSelected = form.category === c;
                    if (isEditing) {
                      return (
                        <div key={c} className="inline-flex items-center gap-1 border border-indigo-300 rounded-full pl-2 pr-1 py-0.5 bg-white">
                          <input
                            autoFocus
                            value={editingCatName}
                            onChange={(e) => setEditingCatName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); renameCategory(c, editingCatName); }
                              if (e.key === "Escape") setEditingCat(null);
                            }}
                            className="text-xs w-24 outline-none bg-transparent"
                          />
                          <button type="button" onClick={() => renameCategory(c, editingCatName)}
                            className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-600 text-white">{t("ঠিক", "OK")}</button>
                          <button type="button" onClick={() => setEditingCat(null)}
                            className="p-0.5 text-slate-400 hover:text-slate-600"><X className="w-3 h-3" /></button>
                        </div>
                      );
                    }
                    return (
                      <div key={c}
                        className={`inline-flex items-center rounded-full border text-xs ${isSelected ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 text-slate-700"}`}>
                        <button type="button" onClick={() => setForm({ ...form, category: isSelected ? "" : c })}
                          className={`pl-2.5 pr-1.5 py-1 ${isSelected ? "" : "hover:bg-slate-50 rounded-l-full"}`}>
                          {c}
                        </button>
                        <button type="button" title={t("এডিট", "Edit")}
                          onClick={() => { setEditingCat(c); setEditingCatName(c); }}
                          className={`p-1 ${isSelected ? "text-indigo-100 hover:text-white" : "text-slate-400 hover:text-slate-700"}`}>
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button type="button" title={t("মুছুন", "Delete")}
                          onClick={() => removeCategory(c)}
                          className={`p-1 pr-2 ${isSelected ? "text-indigo-100 hover:text-white" : "text-slate-400 hover:text-rose-600"}`}>
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { label: t("৭ দিন", "7 days"), days: 7 },
                { label: t("৩০ দিন", "30 days"), days: 30 },
                { label: t("৯০ দিন", "90 days"), days: 90 },
                { label: t("১ বছর", "1 year"), days: 365 },
              ].map((p) => (
                <button key={p.days} type="button" onClick={() => {
                  const s = new Date();
                  const e = new Date(s.getTime() + p.days * 86400000);
                  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                  setForm({ ...form, start_date: fmt(s), deadline: fmt(e) });
                }} className="px-2.5 py-1 text-xs border border-slate-200 rounded-full hover:bg-slate-50">
                  {p.label}
                </button>
              ))}
            </div>
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

      <Dialog open={catManagerOpen} onOpenChange={setCatManagerOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("ক্যাটাগরি ব্যবস্থাপনা", "Manage categories")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input type="text" value={newCat} onChange={(e) => setNewCat(e.target.value)}
                placeholder={t("নতুন ক্যাটাগরির নাম", "New category name")}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const a = addCategory(newCat); if (a) setNewCat(""); } }}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              <button type="button" onClick={() => { const a = addCategory(newCat); if (a) setNewCat(""); }}
                className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg inline-flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> {t("যোগ", "Add")}
              </button>
            </div>
            {cats.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">{t("কোনো ক্যাটাগরি নেই", "No categories yet")}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {cats.map((c) => (
                  <div key={c} className="inline-flex items-center gap-1 border border-slate-200 rounded-full pl-2.5 pr-1 py-0.5 text-xs">
                    <span>{c}</span>
                    <button onClick={() => removeCategory(c)} className="p-0.5 text-slate-400 hover:text-rose-600">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}