import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { fmtTk, toBn } from "@/lib/finance";
import { Plus, Trash2, Check, Pencil, ArrowUpRight, ArrowDownRight, Scale, Users, Calendar, TrendingDown, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/hooks/useLanguage";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { DateRangeFilter, type DateView } from "@/components/DateRangeFilter";

export const Route = createFileRoute("/_authenticated/debts")({ component: DebtsPage });

type Debt = { id: string; kind: "receivable" | "payable"; amount: number; person: string; note: string | null; due_date: string | null; settled: boolean; created_at: string };

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

function DebtsPage() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const uid = useCurrentUserId();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ kind: "receivable" as "receivable" | "payable", person: "", amount: "", due_date: "", note: "" });
  const [query, setQuery] = useState("");
  const [dateView, setDateView] = useState<DateView>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const q = useQuery({
    queryKey: ["debts", "all", uid],
    queryFn: async () => {
      const { data, error } = await supabase.from("debts").select("id,kind,amount,person,note,due_date,settled,created_at").eq("user_id", uid).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Debt[];
    },
  });
  const all = q.data ?? [];
  const list = useMemo(() => {
    const s = query.trim().toLowerCase();
    return all.filter((d) => {
      if (s && !(d.person.toLowerCase().includes(s) || (d.note ?? "").toLowerCase().includes(s))) return false;
      if (dateFrom || dateTo) {
        const key = (d.created_at || "").slice(0, 10);
        if (dateFrom && key < dateFrom) return false;
        if (dateTo && key > dateTo) return false;
      }
      return true;
    });
  }, [all, query, dateFrom, dateTo]);
  const receivable = all.filter((d) => d.kind === "receivable" && !d.settled).reduce((s, d) => s + Number(d.amount), 0);
  const payable = all.filter((d) => d.kind === "payable" && !d.settled).reduce((s, d) => s + Number(d.amount), 0);
  const net = receivable - payable;
  const totalAbs = receivable + payable;
  const recPct = totalAbs > 0 ? (receivable / totalAbs) * 100 : 50;
  const activeCount = all.filter((d) => !d.settled).length;

  const { spark, thisMonth, lastMonth, topPerson } = useMemo(() => {
    const days = 14;
    const today = new Date();
    const buckets = new Array(days).fill(0);
    for (const d of all) {
      const dt = new Date(d.created_at);
      const diff = Math.floor((+today - +dt) / 86400000);
      if (diff >= 0 && diff < days) buckets[days - 1 - diff] += Number(d.amount);
    }
    const ym = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
    const tm = ym(today);
    const lm = ym(new Date(today.getFullYear(), today.getMonth() - 1, 1));
    let tmSum = 0, lmSum = 0;
    const personMap: Record<string, number> = {};
    for (const d of all) {
      const dt = new Date(d.created_at);
      const amt = Number(d.amount);
      if (ym(dt) === tm) tmSum += amt;
      if (ym(dt) === lm) lmSum += amt;
      personMap[d.person] = (personMap[d.person] ?? 0) + amt;
    }
    const top = Object.entries(personMap).sort((a, b) => b[1] - a[1])[0];
    return { spark: buckets, thisMonth: tmSum, lastMonth: lmSum, topPerson: top };
  }, [all]);

  const momPct = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : (thisMonth > 0 ? 100 : 0);

  const openNew = () => {
    setEditingId(null);
    setForm({ kind: "receivable", person: "", amount: "", due_date: "", note: "" });
    setOpen(true);
  };
  const openEdit = (d: Debt) => {
    setEditingId(d.id);
    setForm({
      kind: d.kind,
      person: d.person,
      amount: String(d.amount),
      due_date: d.due_date ?? "",
      note: d.note ?? "",
    });
    setOpen(true);
  };
  const save = async () => {
    if (!form.person.trim() || !form.amount) { toast.error(t("ব্যক্তি ও পরিমাণ দিন", "Enter person and amount")); return; }
    const payload = {
      kind: form.kind,
      person: form.person.trim(),
      amount: parseFloat(form.amount),
      due_date: form.due_date || null,
      note: form.note || null,
    };
    if (editingId) {
      const { error } = await supabase.from("debts").update(payload).eq("id", editingId).eq("user_id", uid);
      if (error) { toast.error(error.message); return; }
      toast.success(t("আপডেট হয়েছে", "Updated"));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("debts").insert({ user_id: user.id, ...payload });
      if (error) { toast.error(error.message); return; }
      toast.success(t("যোগ হয়েছে", "Added"));
    }
    qc.invalidateQueries({ queryKey: ["debts"] });
    setOpen(false);
    setEditingId(null);
    setForm({ kind: "receivable", person: "", amount: "", due_date: "", note: "" });
  };
  const toggle = async (d: Debt) => {
    const { error } = await supabase.from("debts").update({ settled: !d.settled }).eq("id", d.id).eq("user_id", uid);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["debts"] });
  };
  const remove = async (id: string) => {
    if (!confirm(t("মুছে ফেলবেন?", "Delete this?"))) return;
    const { error } = await supabase.from("debts").delete().eq("id", id).eq("user_id", uid);
    if (error) { toast.error(error.message); return; }
    toast.success(t("মুছে ফেলা হয়েছে", "Deleted"));
    qc.invalidateQueries({ queryKey: ["debts"] });
  };

  return (
    <AppShell title={t("দেনা / পাওনা", "Receivable / Payable")}>
      {/* Hero summary */}
      <div className="relative overflow-hidden rounded-2xl p-5 sm:p-7 mb-5 text-white shadow-2xl shadow-indigo-500/30"
        style={{ background: "linear-gradient(135deg,#4f46e5 0%,#7c3aed 45%,#a855f7 100%)" }}>
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-fuchsia-300/20 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-indigo-50/90 text-xs font-medium tracking-wider uppercase mb-2">
              <Scale className="w-3.5 h-3.5" /> {t("নেট ব্যালেন্স", "Net balance")}
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight drop-shadow-sm">{net >= 0 ? "+" : ""}{fmtTk(net)}</div>
            <div className="flex flex-wrap items-center gap-3 mt-3 text-sm">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
                <ArrowDownRight className="w-3.5 h-3.5 rotate-180" />
                <span className="font-semibold">{fmtTk(receivable)}</span>
                <span className="text-indigo-50/80 text-xs">{t("পাওনা", "Receivable")}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span className="font-semibold">{fmtTk(payable)}</span>
                <span className="text-indigo-50/80 text-xs">{t("দেনা", "Payable")}</span>
              </span>
              <span className="text-indigo-50/80 text-xs">{t("সক্রিয় এন্ট্রি", "Active")}: <b className="text-white">{toBn(activeCount)}</b></span>
            </div>
          </div>
          <div className="shrink-0 w-full sm:w-56 flex flex-col items-stretch gap-1.5">
            <div className="text-[11px] uppercase tracking-wider text-indigo-50/80 text-right">{t("শেষ ১৪ দিন", "Last 14 days")}</div>
            <div className="flex justify-end"><Sparkline points={spark} /></div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden flex">
              <div className="h-full bg-gradient-to-r from-emerald-300 to-emerald-400 transition-all" style={{ width: `${recPct}%` }} />
              <div className="h-full bg-gradient-to-r from-rose-300 to-rose-400 transition-all" style={{ width: `${100 - recPct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-indigo-50/90">
              <span>{t("পাওনা", "Recv")} {toBn(recPct.toFixed(0))}%</span>
              <span>{t("দেনা", "Pay")} {toBn((100 - recPct).toFixed(0))}%</span>
            </div>
          </div>
        </div>
        <div className="relative flex flex-wrap items-center gap-3 mt-4 text-sm">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
            <ArrowDownRight className={`w-3.5 h-3.5 ${momPct >= 0 ? "" : "rotate-180"}`} />
            <span className="font-semibold">{momPct >= 0 ? "+" : ""}{toBn(momPct.toFixed(1))}%</span>
            <span className="text-indigo-50/80 text-xs">{t("গত মাসের তুলনায়", "vs last month")}</span>
          </span>
          <span className="text-indigo-50/80 text-xs">{t("মোট এন্ট্রি", "Total entries")}: <b className="text-white">{toBn(all.length)}</b></span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button onClick={openNew} className="group flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg text-sm font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] transition-all">
          <Plus className="w-4 h-4" /> {t("নতুন এন্ট্রি", "New entry")}
        </button>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-5">
        <div className="relative overflow-hidden bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-400 to-pink-400" />
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{t("এই মাস", "This month")}</div>
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center"><Calendar className="w-4 h-4 text-rose-600" /></div>
          </div>
          <div className="text-xl font-extrabold text-slate-800 mt-1">{fmtTk(thisMonth)}</div>
        </div>
        <div className="relative overflow-hidden bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-indigo-400" />
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{t("গত মাস", "Last month")}</div>
            <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center"><TrendingDown className="w-4 h-4 text-sky-600" /></div>
          </div>
          <div className="text-xl font-extrabold text-slate-800 mt-1">{fmtTk(lastMonth)}</div>
        </div>
        <div className="col-span-2 lg:col-span-1 relative overflow-hidden bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{t("শীর্ষ ব্যক্তি", "Top person")}</div>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center"><AlertCircle className="w-4 h-4 text-amber-600" /></div>
          </div>
          <div className="text-base font-bold text-slate-800 mt-1 truncate">{topPerson?.[0] ?? "—"}</div>
          {topPerson && <div className="text-xs text-slate-500 font-medium">{fmtTk(topPerson[1])}</div>}
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("ব্যক্তি বা নোট খুঁজুন...", "Search person or note...")}
            className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"/></svg>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-600">
          <span className="text-slate-400">{t("দেখাচ্ছে", "Showing")}:</span> <b>{toBn(list.length)}</b>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gradient-to-r from-slate-50 to-indigo-50/40 text-slate-600 text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider">{t("ধরন", "Type")}</th>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider">{t("ব্যক্তি", "Person")}</th>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider">{t("নোট", "Note")}</th>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider">{t("তারিখ", "Date")}</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wider">{t("পরিমাণ", "Amount")}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={6} className="text-center text-slate-400 py-8">{t("লোড হচ্ছে...", "Loading...")}</td></tr>}
            {!q.isLoading && list.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12">
                <div className="inline-flex flex-col items-center gap-2">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center"><Users className="w-7 h-7 text-indigo-600" /></div>
                  <div className="text-slate-500 text-sm">{t("কোনো রেকর্ড নেই", "No records yet")}</div>
                </div>
              </td></tr>
            )}
            {list.map((d) => (
              <tr key={d.id} className={`group border-t border-slate-100 hover:bg-indigo-50/30 transition-colors ${d.settled ? "opacity-50" : ""}`}>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 ${d.kind === "receivable" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}>
                    {d.kind === "receivable" ? <ArrowDownRight className="w-3 h-3 rotate-180" /> : <ArrowUpRight className="w-3 h-3" />}
                    {d.kind === "receivable" ? t("পাওনা", "Receivable") : t("দেনা", "Payable")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white ${d.kind === "receivable" ? "bg-gradient-to-br from-emerald-400 to-teal-500" : "bg-gradient-to-br from-rose-400 to-pink-500"}`}>
                      {d.person.trim().charAt(0).toUpperCase() || "?"}
                    </div>
                    <span className="font-medium text-slate-700">{d.person}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{d.note || "—"}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{d.due_date ? toBn(d.due_date) : "—"}</td>
                <td className={`px-4 py-3 text-right font-bold ${d.kind === "receivable" ? "text-emerald-600" : "text-rose-600"}`}>{d.kind === "receivable" ? "+" : "−"}{fmtTk(Number(d.amount))}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => toggle(d)} title={d.settled ? t("আবার সক্রিয়", "Reactivate") : t("পরিশোধিত", "Settled")} className={`p-1.5 rounded-md hover:bg-emerald-100 text-slate-400 hover:text-emerald-600 transition-colors ${d.settled ? "text-emerald-600" : ""}`}><Check className="w-4 h-4" /></button>
                    <button onClick={() => openEdit(d)} title={t("এডিট", "Edit")} className="p-1.5 rounded-md hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 transition-colors"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(d.id)} title="Delete" className="p-1.5 rounded-md hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Mobile / tablet card list */}
      <div className="lg:hidden space-y-2">
        {q.isLoading && <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-400 text-sm">{t("লোড হচ্ছে...", "Loading...")}</div>}
        {!q.isLoading && list.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mb-3"><Users className="w-7 h-7 text-indigo-600" /></div>
            <div className="text-slate-500 text-sm">{t("কোনো রেকর্ড নেই", "No records yet")}</div>
          </div>
        )}
        {list.map((d) => (
          <div key={d.id} className={`relative bg-white rounded-xl border border-slate-200 p-3 flex items-start gap-3 shadow-sm hover:shadow-md transition-all overflow-hidden ${d.settled ? "opacity-60" : ""}`}>
            <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${d.kind === "receivable" ? "from-emerald-400 to-teal-500" : "from-rose-400 to-pink-500"}`} />
            <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white ${d.kind === "receivable" ? "bg-gradient-to-br from-emerald-400 to-teal-500" : "bg-gradient-to-br from-rose-400 to-pink-500"}`}>
              {d.person.trim().charAt(0).toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-slate-800 text-sm truncate">{d.person}</div>
                <div className={`font-bold text-sm whitespace-nowrap ${d.kind === "receivable" ? "text-emerald-600" : "text-rose-600"}`}>{d.kind === "receivable" ? "+" : "−"}{fmtTk(Number(d.amount))}</div>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${d.kind === "receivable" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}>
                  {d.kind === "receivable" ? <ArrowDownRight className="w-2.5 h-2.5 rotate-180" /> : <ArrowUpRight className="w-2.5 h-2.5" />}
                  {d.kind === "receivable" ? t("পাওনা", "Receivable") : t("দেনা", "Payable")}
                </span>
                {d.settled && <span className="text-[10px] text-emerald-600 font-semibold">{t("পরিশোধিত", "Settled")}</span>}
              </div>
              {d.note && <div className="text-xs text-slate-600 mt-1 truncate">{d.note}</div>}
              <div className="text-[11px] text-slate-400 mt-1">{d.due_date ? toBn(d.due_date) : "—"}</div>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <button onClick={() => toggle(d)} title={d.settled ? t("আবার সক্রিয়", "Reactivate") : t("পরিশোধিত", "Settled")} className={`p-1.5 rounded-md hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 ${d.settled ? "text-emerald-600" : ""}`}><Check className="w-4 h-4" /></button>
              <button onClick={() => openEdit(d)} className="p-1.5 rounded-md hover:bg-indigo-50 text-slate-400 hover:text-indigo-600" title="Edit"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => remove(d.id)} className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600" title="Delete"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? t("পাওনা/দেনা এডিট", "Edit receivable/payable") : t("নতুন পাওনা/দেনা", "New receivable/payable")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setForm({ ...form, kind: "receivable" })} className={`py-2 rounded-lg border text-sm font-medium ${form.kind === "receivable" ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "border-slate-200 text-slate-600"}`}>{t("পাওনা", "Receivable")}</button>
              <button onClick={() => setForm({ ...form, kind: "payable" })} className={`py-2 rounded-lg border text-sm font-medium ${form.kind === "payable" ? "bg-rose-50 border-rose-300 text-rose-700" : "border-slate-200 text-slate-600"}`}>{t("দেনা", "Payable")}</button>
            </div>
            <input value={form.person} onChange={(e) => setForm({ ...form, person: e.target.value })} placeholder={t("ব্যক্তির নাম", "Person's name")} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder={t("পরিমাণ ৳", "Amount ৳")} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={t("নোট (ঐচ্ছিক)", "Note (optional)")} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
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