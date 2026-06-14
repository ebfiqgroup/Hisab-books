import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { fmtTk, toBn, categoryColor } from "@/lib/finance";
import { useCustomCategories } from "@/hooks/useCustomCategories";
import { loadCustomCats, saveCustomCats } from "@/lib/finance";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Wallet, CalendarClock, X, ListFilter } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { DateRangeFilter, type DateView } from "@/components/DateRangeFilter";

export const Route = createFileRoute("/_authenticated/budget")({ component: BudgetPage });

type Budget = {
  id: string;
  category: string;
  monthly_limit: number;
  current: number;
  label: string | null;
  start_at: string;
  end_at: string;
  status: "pending" | "ongoing" | "completed" | null;
};

const BN_MONTHS_SHORT = ["জানু", "ফেব", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগ", "সেপ্ট", "অক্টো", "নভে", "ডিসে"];
const fmtBnDateTime = (iso: string) => {
  const d = new Date(iso);
  const date = `${toBn(d.getDate())} ${BN_MONTHS_SHORT[d.getMonth()]}, ${toBn(d.getFullYear())}`;
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const time = `${toBn(h)}:${toBn(String(m).padStart(2, "0"))} ${ampm}`;
  return `${date} · ${time}`;
};

// Convert Date <-> input[type="datetime-local"] value (in local time, no TZ)
const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (s: string) => new Date(s).toISOString();

type FormState = {
  id?: string;
  label: string;
  category: string;
  amount: string;
  current: string;
  start: string; // datetime-local value
  end: string;
};

function emptyForm(defaultCat: string): FormState {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes());
  return { label: "", category: defaultCat, amount: "", current: "", start: toLocalInput(now), end: toLocalInput(end) };
}

function BudgetPage() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const uid = useCurrentUserId();
  const { forType } = useCustomCategories();
  const cats = forType("expense");
  const [newCat, setNewCat] = useState("");
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");

  const addCategory = (raw: string) => {
    const name = raw.trim();
    if (!name) { toast.error(t("ক্যাটাগরির নাম দিন", "Enter category name")); return null; }
    const m = loadCustomCats();
    if (m.expense.includes(name)) { toast.error(t("এই ক্যাটাগরি ইতোমধ্যে আছে", "Category already exists")); return name; }
    saveCustomCats({ ...m, expense: [...m.expense, name] });
    toast.success(t("ক্যাটাগরি যুক্ত হয়েছে", "Category added"));
    return name;
  };

  const renameCategory = async (oldName: string, rawNew: string) => {
    const newName = rawNew.trim();
    if (!newName) { toast.error(t("নাম খালি হতে পারবে না", "Name cannot be empty")); return; }
    if (newName === oldName) { setEditingCat(null); return; }
    const m = loadCustomCats();
    if (m.expense.includes(newName)) { toast.error(t("এই নাম ইতোমধ্যে আছে", "This name already exists")); return; }
    saveCustomCats({ ...m, expense: m.expense.map((c) => (c === oldName ? newName : c)) });
    // Update affected budgets in DB
    const { error } = await supabase.from("budgets").update({ category: newName }).eq("category", oldName).eq("user_id", uid);
    if (error) { toast.error(error.message); return; }
    if (form.category === oldName) setForm({ ...form, category: newName });
    setEditingCat(null);
    toast.success(t("ক্যাটাগরি আপডেট হয়েছে", "Category updated"));
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };

  const deleteCategory = async (name: string) => {
    const used = (bQ.data ?? []).some((b) => b.category === name);
    const msg = used
      ? t(`"${name}" ক্যাটাগরি ব্যবহৃত হচ্ছে এমন বাজেটসহ মুছে ফেলবেন?`, `Delete category "${name}" along with budgets using it?`)
      : t(`"${name}" ক্যাটাগরি মুছে ফেলবেন?`, `Delete category "${name}"?`);
    if (!confirm(msg)) return;
    if (used) {
      const { error } = await supabase.from("budgets").delete().eq("category", name).eq("user_id", uid);
      if (error) { toast.error(error.message); return; }
    }
    const m = loadCustomCats();
    saveCustomCats({ ...m, expense: m.expense.filter((c) => c !== name) });
    if (form.category === name) setForm({ ...form, category: "" });
    toast.success(t("ক্যাটাগরি মুছে ফেলা হয়েছে", "Category deleted"));
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm(cats[0] ?? ""));
  const [filter, setFilter] = useState<"all" | "pending" | "ongoing" | "completed">("all");
  const [dateView, setDateView] = useState<DateView>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const nowIso = new Date().toISOString();

  const bQ = useQuery({
    queryKey: ["budgets", uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budgets")
        .select("id,category,monthly_limit,current,label,start_at,end_at,status")
        .eq("user_id", uid)
        .order("start_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Budget[];
    },
  });

  // Pull all expense transactions to auto-compute spent per budget category
  const txQ = useQuery({
    queryKey: ["transactions", "expense-by-category", uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("category,amount,type,occurred_on")
        .eq("user_id", uid)
        .eq("type", "expense");
      if (error) throw error;
      return (data ?? []) as { category: string; amount: number; occurred_on: string }[];
    },
  });
  const txList = txQ.data ?? [];
  const spentFor = (b: Budget) => {
    const eIso = b.end_at.slice(0, 10);
    const auto = txList
      .filter((t) => t.category === b.category && t.occurred_on <= eIso)
      .reduce((s, t) => s + Number(t.amount), 0);
    return Math.max(Number(b.current ?? 0), auto);
  };

  const openCreate = () => {
    setForm(emptyForm(cats[0] ?? ""));
    setOpen(true);
  };
  const openEdit = (b: Budget) => {
    setForm({
      id: b.id,
      label: b.label ?? "",
      category: b.category,
      amount: String(b.monthly_limit),
      current: String(b.current ?? 0),
      start: toLocalInput(new Date(b.start_at)),
      end: toLocalInput(new Date(b.end_at)),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.category) { toast.error(t("ক্যাটাগরি দিন", "Select category")); return; }
    const amt = parseFloat(form.amount);
    if (Number.isNaN(amt) || amt < 0) { toast.error(t("সঠিক পরিমাণ দিন", "Enter a valid amount")); return; }
    const cur = parseFloat(form.current || "0");
    if (Number.isNaN(cur) || cur < 0) { toast.error(t("সঠিক বর্তমান টাকা দিন", "Enter a valid current amount")); return; }
    if (!form.start || !form.end) { toast.error(t("শুরু ও শেষ সময় দিন", "Enter start and end time")); return; }
    if (new Date(form.end) <= new Date(form.start)) { toast.error(t("শেষ সময় শুরুর পরে হতে হবে", "End must be after start")); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = {
      label: form.label.trim() || null,
      category: form.category,
      monthly_limit: amt,
      current: cur,
      start_at: fromLocalInput(form.start),
      end_at: fromLocalInput(form.end),
    };
    const { error } = form.id
      ? await supabase.from("budgets").update(payload).eq("id", form.id).eq("user_id", uid)
      : await supabase.from("budgets").insert({ ...payload, user_id: user.id });
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? t("আপডেট হয়েছে", "Updated") : t("বাজেট যুক্ত হয়েছে", "Budget added"));
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };

  const remove = async (id: string) => {
    if (!confirm(t("বাজেট মুছে ফেলবেন?", "Delete this budget?"))) return;
    const { error } = await supabase.from("budgets").delete().eq("id", id).eq("user_id", uid);
    if (error) { toast.error(error.message); return; }
    toast.success(t("মুছে ফেলা হয়েছে", "Deleted"));
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };

  const autoStatus = (b: Budget): "pending" | "ongoing" | "completed" =>
    nowIso < b.start_at ? "pending" : nowIso > b.end_at ? "completed" : "ongoing";
  const effStatus = (b: Budget) => b.status ?? autoStatus(b);

  const setStatus = async (b: Budget, s: "pending" | "ongoing" | "completed") => {
    const next = effStatus(b) === s ? null : s;
    const { error } = await supabase.from("budgets").update({ status: next }).eq("id", b.id).eq("user_id", uid);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };

  const list = bQ.data ?? [];
  const filteredList = useMemo(() => {
    return list.filter((b) => {
      if (filter !== "all" && effStatus(b) !== filter) return false;
      if (dateFrom || dateTo) {
        // overlap test between budget [start_at..end_at] and [dateFrom..dateTo]
        const bStart = (b.start_at || "").slice(0, 10);
        const bEnd = (b.end_at || "").slice(0, 10);
        if (dateFrom && bEnd && bEnd < dateFrom) return false;
        if (dateTo && bStart && bStart > dateTo) return false;
      }
      return true;
    });
  }, [list, filter, nowIso, dateFrom, dateTo]);
  const totalLimit = filteredList.reduce((s, b) => s + Number(b.monthly_limit), 0);
  const totalSpent = filteredList.reduce((s, b) => s + spentFor(b), 0);
  const totalPct = totalLimit > 0 ? Math.min(100, (totalSpent / totalLimit) * 100) : 0;
  const totalRemaining = totalLimit - totalSpent;
  const completedCount = filteredList.filter((b) => effStatus(b) === "completed").length;
  const overBudget = totalLimit > 0 && totalSpent > totalLimit;

  const filterBtns: { key: typeof filter; labelBn: string; labelEn: string }[] = [
    { key: "all", labelBn: "পতিটি বিষয়", labelEn: "All" },
    { key: "pending", labelBn: "অপেক্ষিত", labelEn: "Pending" },
    { key: "ongoing", labelBn: "চলমান", labelEn: "Ongoing" },
    { key: "completed", labelBn: "শেষ", labelEn: "Completed" },
  ];

  return (
    <AppShell title={t("বাজেট", "Budget")}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{t("আমার বাজেট", "My budgets")}</h2>
          <p className="text-xs text-slate-500">{t("কাস্টম তারিখ ও সময় রেঞ্জ সহ বাজেট পরিচালনা", "Manage budgets with custom date/time ranges")}</p>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold rounded-lg shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] transition-all">
          <Plus className="w-4 h-4" /> {t("নতুন বাজেট", "New budget")}
        </button>
      </div>

      {/* Summary hero */}
      <div className="relative overflow-hidden rounded-2xl p-5 sm:p-6 mb-5 text-white shadow-2xl shadow-indigo-500/30"
        style={{ background: overBudget ? "linear-gradient(135deg,#e11d48,#f97316)" : "linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#a855f7 100%)" }}>
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-fuchsia-300/20 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center"><Wallet className="w-5 h-5" /></div>
            <div>
              <div className="text-[11px] uppercase tracking-wider font-semibold opacity-90">{t("মোট ব্যয় / মোট বাজেট", "Total spent / Total budget")}</div>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {fmtTk(totalSpent)} <span className="opacity-70 text-base font-bold">/ {fmtTk(totalLimit)}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2.5 sm:p-3 border border-white/15">
              <div className="text-[10px] uppercase tracking-wider opacity-80 font-semibold">{t("বর্তমান ব্যয়", "Current")}</div>
              <div className="text-sm sm:text-lg font-extrabold tracking-tight tabular-nums">{fmtTk(totalSpent)}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2.5 sm:p-3 border border-white/15">
              <div className="text-[10px] uppercase tracking-wider opacity-80 font-semibold">{totalRemaining >= 0 ? t("বাকি", "Remaining") : t("অতিরিক্ত", "Over")}</div>
              <div className="text-sm sm:text-lg font-extrabold tracking-tight tabular-nums">{fmtTk(Math.abs(totalRemaining))}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2.5 sm:p-3 border border-white/15">
              <div className="text-[10px] uppercase tracking-wider opacity-80 font-semibold">{t("পূর্ণ বাজেট", "Completed")}</div>
              <div className="text-sm sm:text-lg font-extrabold tracking-tight tabular-nums">{toBn(completedCount)} / {toBn(filteredList.length)}</div>
            </div>
          </div>
          <div className="h-2.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
            <div className="h-full bg-white rounded-full shadow-lg transition-all" style={{ width: `${totalPct}%` }} />
          </div>
          <div className="flex justify-between text-xs mt-1.5 opacity-90 font-medium">
            <span>{toBn(totalPct.toFixed(1))}% {t("ব্যবহৃত", "used")}</span>
            <span>{totalRemaining >= 0 ? t("বাকি", "Remaining") : t("অতিরিক্ত", "Over")}: {fmtTk(Math.abs(totalRemaining))}</span>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
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

      <div className="mb-4">
        <DateRangeFilter view={dateView} from={dateFrom} to={dateTo} accent="indigo"
          onChange={(n) => { setDateView(n.view); setDateFrom(n.from); setDateTo(n.to); }} />
      </div>

      {/* List */}
      {filteredList.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <Wallet className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-600 text-sm mb-3">
            {filter === "all"
              ? t("এখনো কোনো বাজেট নেই", "No budgets yet")
              : t("এই ফিল্টারে কোনো বাজেট পাওয়া যায়নি", "No budgets match this filter")}
          </p>
          {filter === "all" && (
            <button onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg">
              <Plus className="w-4 h-4" /> {t("প্রথম বাজেট যুক্ত করুন", "Add first budget")}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredList.map((b) => {
            const spent = spentFor(b);
            const pct = b.monthly_limit > 0 ? Math.min(100, (spent / b.monthly_limit) * 100) : 0;
            const over = b.monthly_limit > 0 && spent > b.monthly_limit;
            const status = effStatus(b);
            const statusBtns: { key: "pending" | "ongoing" | "completed"; labelBn: string; labelEn: string; active: string }[] = [
              { key: "pending", labelBn: "অপেক্ষিত", labelEn: "Pending", active: "bg-amber-500 text-white border-amber-500" },
              { key: "ongoing", labelBn: "চলমান", labelEn: "Ongoing", active: "bg-emerald-500 text-white border-emerald-500" },
              { key: "completed", labelBn: "শেষ", labelEn: "Completed", active: "bg-slate-500 text-white border-slate-500" },
            ];
            const catCol = categoryColor(b.category);
            const grad = over
              ? "linear-gradient(135deg,#e11d48,#f43f5e)"
              : `linear-gradient(135deg, ${catCol}, ${catCol}CC)`;
            const completed = pct >= 100;
            return (
              <div key={b.id} className="group relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
                <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: grad }} />
                <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20 blur-2xl" style={{ background: grad }} />
                <div className="relative p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg" style={{ background: grad }}>
                    <Wallet className="w-6 h-6" />
                  </div>
                  <div className="flex items-center gap-1">
                    {completed && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 ring-1 ring-amber-200">★ {t("পূর্ণ", "Done")}</span>}
                    <button onClick={() => openEdit(b)} className="p-1.5 rounded-md hover:bg-slate-50 text-slate-400 hover:text-slate-700" title={t("এডিট", "Edit")}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(b.id)} className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600" title={t("মুছুন", "Delete")}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="font-bold text-slate-800 mb-1 text-base truncate">{b.label || b.category}</div>
                <div className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 mb-2">{b.category}</div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {statusBtns.map((sb) => (
                    <button
                      key={sb.key}
                      onClick={() => setStatus(b, sb.key)}
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

                {(() => {
                  const startMs = new Date(b.start_at).getTime();
                  const endMs = new Date(b.end_at).getTime();
                  const nowMs = Date.now();
                  const totalMs = Math.max(1, endMs - startMs);
                  const elapsedMs = Math.max(0, Math.min(totalMs, nowMs - startMs));
                  const timePct = (elapsedMs / totalMs) * 100;
                  const remainingMs = Math.max(0, endMs - nowMs);
                  const days = Math.floor(remainingMs / 86400000);
                  const hours = Math.floor((remainingMs % 86400000) / 3600000);
                  const ahead = pct < timePct - 1;
                  const behind = pct > timePct + 1;
                  const remainingMoney = b.monthly_limit - spent;
                  return (
                    <>
                      {/* Money progress */}
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-slate-500 font-medium">💰 {t("টাকা", "Money")} <span className="text-slate-700 font-semibold">{fmtTk(spent)} / {fmtTk(b.monthly_limit)}</span></span>
                        <span className="text-slate-400">{remainingMoney >= 0 ? t("বাকি", "Left") : t("অতিরিক্ত", "Over")}: {fmtTk(Math.abs(remainingMoney))}</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-1 shadow-inner">
                        <div className="h-full rounded-full transition-all shadow-sm" style={{ width: `${pct}%`, background: grad }} />
                      </div>
                      <div className="text-[11px] mb-3">
                        <span className={`font-bold ${over ? "text-rose-600" : ""}`} style={{ color: !over && pct >= 100 ? "#059669" : undefined }}>{toBn(pct.toFixed(0))}% {t("ব্যবহৃত", "used")}</span>
                      </div>

                      {/* Time progress */}
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-slate-500 font-medium">⏱ {t("সময়", "Time")}</span>
                        <span className="text-slate-400">
                          {remainingMs > 0
                            ? `${toBn(days)} ${t("দিন", "d")} ${toBn(hours)} ${t("ঘন্টা বাকি", "h left")}`
                            : t("শেষ", "Ended")}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-1 shadow-inner">
                        <div className="h-full rounded-full transition-all bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${timePct}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-amber-600">{toBn(timePct.toFixed(0))}% {t("সময় পার", "time passed")}</span>
                        {b.monthly_limit > 0 && (
                          ahead ? <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-semibold">✓ {t("সাশ্রয়ে", "On pace")}</span>
                          : behind ? <span className="px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 font-semibold">⚠ {t("দ্রুত খরচ", "Spending fast")}</span>
                          : <span className="px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-500 font-semibold">{t("সঠিক গতি", "On track")}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-2">
                        <CalendarClock className="w-3 h-3" />
                        <span className="truncate">{fmtBnDateTime(b.start_at)} → {fmtBnDateTime(b.end_at)}</span>
                      </div>
                    </>
                  );
                })()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4" onClick={() => setOpen(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">{form.id ? t("বাজেট এডিট", "Edit budget") : t("নতুন বাজেট", "New budget")}</h3>
              <button onClick={() => setOpen(false)} className="p-1 rounded-md hover:bg-slate-100 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">{t("লেবেল (ঐচ্ছিক)", "Label (optional)")}</label>
                <input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder={t("যেমন: রমজানের খাবার", "e.g. Ramadan food")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" />
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
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-md text-sm" />
                  <button type="button" onClick={() => {
                    const added = addCategory(newCat);
                    if (added) { setForm({ ...form, category: added }); setNewCat(""); }
                  }} className="px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-md inline-flex items-center gap-1">
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
                          <button type="button" onClick={() => setForm({ ...form, category: c })}
                            className={`pl-2.5 pr-1.5 py-1 ${isSelected ? "" : "hover:bg-slate-50 rounded-l-full"}`}>
                            <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: categoryColor(c) }} />
                            {c}
                          </button>
                          <button type="button" title={t("এডিট", "Edit")}
                            onClick={() => { setEditingCat(c); setEditingCatName(c); }}
                            className={`p-1 ${isSelected ? "text-indigo-100 hover:text-white" : "text-slate-400 hover:text-slate-700"}`}>
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button type="button" title={t("মুছুন", "Delete")}
                            onClick={() => deleteCategory(c)}
                            className={`p-1 pr-2 ${isSelected ? "text-indigo-100 hover:text-white" : "text-slate-400 hover:text-rose-600"}`}>
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {!form.category && (
                  <p className="text-xs text-rose-500 mt-1">{t("একটি ক্যাটাগরি বেছে নিন বা নতুন তৈরি করুন", "Select a category or create a new one")}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">{t("মোট টাকা (৳)", "Total (৳)")}</label>
                  <input type="number" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">{t("বর্তমান টাকা (ব্যয়িত)", "Current (spent)")}</label>
                  <input type="number" inputMode="decimal" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })}
                    placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">{t("শুরু (তারিখ ও সময়)", "Start (date & time)")}</label>
                  <input type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">{t("শেষ (তারিখ ও সময়)", "End (date & time)")}</label>
                  <input type="datetime-local" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" />
                </div>
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
                    setForm({ ...form, start: toLocalInput(s), end: toLocalInput(e) });
                  }} className="px-2.5 py-1 text-xs border border-slate-200 rounded-full hover:bg-slate-50">
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setOpen(false)} className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50">{t("বাতিল", "Cancel")}</button>
              <button onClick={save} disabled={!form.category}
                className="flex-1 px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-md">
                {form.id ? t("আপডেট", "Update") : t("যুক্ত করুন", "Add")}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}