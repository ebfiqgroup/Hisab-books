import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { AppShell } from "@/components/AppShell";
import { fmtTk, toBn, BN_MONTHS } from "@/lib/finance";
import { Download, BarChart3, TrendingUp, TrendingDown, PiggyBank, Calendar, ChevronDown, Printer } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/report")({
  head: () => ({
    meta: [
      { title: "রিপোর্ট - আমার হিসাব" },
      { name: "description", content: "মাসিক আর্থিক রিপোর্ট ও বিশ্লেষণ" },
    ],
  }),
  component: ReportPage,
});

type Txn = { type: "income" | "expense"; amount: number; occurred_on: string };
type Row = { key: string; label: string; income: number; expense: number; saving: number };
type Preset = "7d" | "1m" | "3m" | "6m" | "1y" | "custom";

const isoDay = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return x.toISOString().slice(0, 10);
};

function presetRange(p: Preset): { from: string; to: string } {
  const today = new Date();
  const to = isoDay(today);
  const from = new Date(today);
  if (p === "7d") from.setDate(today.getDate() - 6);
  else if (p === "1m") from.setMonth(today.getMonth() - 1);
  else if (p === "3m") from.setMonth(today.getMonth() - 2);
  else if (p === "6m") from.setMonth(today.getMonth() - 5);
  else if (p === "1y") from.setMonth(today.getMonth() - 11);
  return { from: isoDay(from), to };
}

function ReportPage() {
  const uid = useCurrentUserId();
  const [preset, setPreset] = useState<Preset>("6m");
  const [range, setRange] = useState(() => presetRange("6m"));
  const [menuOpen, setMenuOpen] = useState(false);

  const setPresetAndRange = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") setRange(presetRange(p));
  };

  const q = useQuery({
    queryKey: ["transactions", "report", uid, range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("type,amount,occurred_on")
        .eq("user_id", uid)
        .gte("occurred_on", range.from)
        .lte("occurred_on", range.to)
        .order("occurred_on", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Txn[];
    },
  });

  // Decide bucket granularity: daily if <= 62 days, else monthly.
  const { rows, granularity } = useMemo(() => {
    const from = new Date(range.from);
    const to = new Date(range.to);
    const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
    const daily = days <= 62;
    const map = new Map<string, Row>();

    if (daily) {
      for (let i = 0; i < days; i++) {
        const d = new Date(from);
        d.setDate(from.getDate() + i);
        const key = isoDay(d);
        map.set(key, { key, label: `${toBn(d.getDate())} ${BN_MONTHS[d.getMonth()].slice(0, 3)}`, income: 0, expense: 0, saving: 0 });
      }
    } else {
      const cur = new Date(from.getFullYear(), from.getMonth(), 1);
      const end = new Date(to.getFullYear(), to.getMonth(), 1);
      while (cur <= end) {
        const key = `${cur.getFullYear()}-${cur.getMonth()}`;
        const label = from.getFullYear() === to.getFullYear()
          ? BN_MONTHS[cur.getMonth()]
          : `${BN_MONTHS[cur.getMonth()].slice(0, 3)} ${toBn(cur.getFullYear())}`;
        map.set(key, { key, label, income: 0, expense: 0, saving: 0 });
        cur.setMonth(cur.getMonth() + 1);
      }
    }

    for (const t of q.data ?? []) {
      const d = new Date(t.occurred_on);
      const key = daily ? isoDay(d) : `${d.getFullYear()}-${d.getMonth()}`;
      const r = map.get(key);
      if (!r) continue;
      if (t.type === "income") r.income += Number(t.amount);
      else r.expense += Number(t.amount);
    }
    const rows = Array.from(map.values()).map((r) => ({ ...r, saving: r.income - r.expense }));
    return { rows, granularity: daily ? ("day" as const) : ("month" as const) };
  }, [q.data, range.from, range.to]);

  const max = Math.max(1, ...rows.flatMap((r) => [r.income, r.expense, Math.abs(r.saving)]));
  const totals = rows.reduce(
    (a, r) => ({ income: a.income + r.income, expense: a.expense + r.expense, saving: a.saving + r.saving }),
    { income: 0, expense: 0, saving: 0 },
  );
  const nonEmpty = rows.filter((r) => r.income || r.expense);
  const periodLabel = granularity === "day" ? "দৈনিক" : "মাসিক";
  const unitLabel = granularity === "day" ? "দিন" : "মাস";

  const summary = [
    { label: `গড় ${periodLabel} আয়`, value: fmtTk(nonEmpty.length ? totals.income / nonEmpty.length : 0), Icon: TrendingUp, grad: "from-emerald-500 to-teal-600", ring: "ring-emerald-200" },
    { label: `গড় ${periodLabel} ব্যয়`, value: fmtTk(nonEmpty.length ? totals.expense / nonEmpty.length : 0), Icon: TrendingDown, grad: "from-rose-500 to-pink-600", ring: "ring-rose-200" },
    { label: `গড় ${periodLabel} অবশিষ্ট`, value: fmtTk(nonEmpty.length ? totals.saving / nonEmpty.length : 0), Icon: PiggyBank, grad: "from-sky-500 to-blue-600", ring: "ring-sky-200" },
    { label: "মোট রিপোর্ট", value: `${toBn(nonEmpty.length)} ${unitLabel}`, Icon: BarChart3, grad: "from-indigo-500 to-violet-600", ring: "ring-indigo-200" },
  ];

  const colHeader = granularity === "day" ? "তারিখ" : "মাস";

  const downloadCsv = () => {
    const header = `${colHeader},আয়,ব্যয়,অবশিষ্ট\n`;
    const body = rows.map((r) => `${r.label},${Math.round(r.income)},${Math.round(r.expense)},${Math.round(r.saving)}`).join("\n");
    const totalRow = `\nমোট,${Math.round(totals.income)},${Math.round(totals.expense)},${Math.round(totals.saving)}`;
    const blob = new Blob(["\uFEFF" + header + body + totalRow], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${range.from}_to_${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("রিপোর্ট ডাউনলোড হয়েছে");
  };

  const downloadXlsx = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("রিপোর্ট");
    ws.columns = [
      { header: colHeader, key: "label", width: 18 },
      { header: "আয়", key: "income", width: 14 },
      { header: "ব্যয়", key: "expense", width: 14 },
      { header: "অবশিষ্ট", key: "saving", width: 14 },
    ];
    rows.forEach((r) => ws.addRow({
      label: r.label,
      income: Math.round(r.income),
      expense: Math.round(r.expense),
      saving: Math.round(r.saving),
    }));
    ws.addRow({
      label: "মোট",
      income: Math.round(totals.income),
      expense: Math.round(totals.expense),
      saving: Math.round(totals.saving),
    });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${range.from}_to_${range.to}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("এক্সএলএসএক্স রিপোর্ট ডাউনলোড হয়েছে");
  };

  const printReport = () => {
    const rowsHtml = rows.map((r) => `
      <tr>
        <td>${r.label}</td>
        <td style="text-align:right;color:#059669">${fmtTk(r.income)}</td>
        <td style="text-align:right;color:#e11d48">${fmtTk(r.expense)}</td>
        <td style="text-align:right;color:#2563eb">${fmtTk(r.saving)}</td>
      </tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>রিপোর্ট ${range.from} – ${range.to}</title>
      <style>
        *{box-sizing:border-box}
        body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a;padding:24px;margin:0}
        h1{margin:0 0 4px;font-size:22px}
        .meta{color:#64748b;font-size:13px;margin-bottom:16px}
        .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
        .card{border:1px solid #e2e8f0;border-radius:8px;padding:10px}
        .card .l{font-size:11px;color:#64748b}
        .card .v{font-size:15px;font-weight:700;margin-top:2px}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th,td{padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:left}
        th{background:#f8fafc;color:#475569;font-weight:600}
        tr.total td{font-weight:700;background:#eef2ff;color:#3730a3}
        @media print{ button{display:none} body{padding:14px} }
      </style></head><body>
      <h1>আর্থিক রিপোর্ট</h1>
      <div class="meta">নির্বাচিত পরিসর: <strong>${range.from}</strong> থেকে <strong>${range.to}</strong> · ${periodLabel} ভিউ</div>
      <div class="summary">
        ${summary.map((s) => `<div class="card"><div class="l">${s.label}</div><div class="v">${s.value}</div></div>`).join("")}
      </div>
      <table>
        <thead><tr><th>${colHeader}</th><th style="text-align:right">আয়</th><th style="text-align:right">ব্যয়</th><th style="text-align:right">অবশিষ্ট</th></tr></thead>
        <tbody>${rowsHtml}
          <tr class="total"><td>মোট</td>
            <td style="text-align:right">${fmtTk(totals.income)}</td>
            <td style="text-align:right">${fmtTk(totals.expense)}</td>
            <td style="text-align:right">${fmtTk(totals.saving)}</td>
          </tr>
        </tbody>
      </table>
      <script>window.onload=()=>{setTimeout(()=>{window.print()},250)}</script>
      </body></html>`;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { toast.error("পপ-আপ ব্লক করা হয়েছে"); return; }
    w.document.open(); w.document.write(html); w.document.close();
  };

  const presets: { k: Preset; label: string }[] = [
    { k: "7d", label: "৭ দিন" },
    { k: "1m", label: "১ মাস" },
    { k: "3m", label: "৩ মাস" },
    { k: "6m", label: "৬ মাস" },
    { k: "1y", label: "১ বছর" },
    { k: "custom", label: "কাস্টম" },
  ];

  return (
    <AppShell title="রিপোর্ট প্লাটফর্ম">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl p-5 sm:p-6 mb-4 sm:mb-6 text-white shadow-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-16 w-72 h-72 bg-fuchsia-300/20 rounded-full blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white/15 backdrop-blur rounded-full text-xs font-medium mb-2">
              <BarChart3 className="w-3.5 h-3.5" /> {periodLabel} বিশ্লেষণ
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">আর্থিক রিপোর্ট</h2>
            <p className="text-white/80 text-sm mt-1">{range.from} → {range.to} · {toBn(nonEmpty.length)} {unitLabel}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <div><div className="text-[10px] uppercase tracking-wider text-white/70">আয়</div><div className="text-lg sm:text-2xl font-bold">{fmtTk(totals.income)}</div></div>
            <div><div className="text-[10px] uppercase tracking-wider text-white/70">ব্যয়</div><div className="text-lg sm:text-2xl font-bold">{fmtTk(totals.expense)}</div></div>
            <div><div className="text-[10px] uppercase tracking-wider text-white/70">অবশিষ্ট</div><div className="text-lg sm:text-2xl font-bold">{fmtTk(totals.saving)}</div></div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-sm mb-4 sm:mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-indigo-600" />
          <h3 className="font-semibold text-slate-800 text-sm">সময় ফিল্টার</h3>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {presets.map((p) => (
            <button
              key={p.k}
              onClick={() => setPresetAndRange(p.k)}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border transition-all ${
                preset === p.k
                  ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-indigo-600 shadow-md shadow-indigo-200"
                  : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs">
            <span className="block text-slate-500 mb-1">শুরুর তারিখ</span>
            <input
              type="date"
              value={range.from}
              max={range.to}
              onChange={(e) => { setPreset("custom"); setRange((r) => ({ ...r, from: e.target.value })); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
            />
          </label>
          <label className="text-xs">
            <span className="block text-slate-500 mb-1">শেষ তারিখ</span>
            <input
              type="date"
              value={range.to}
              min={range.from}
              onChange={(e) => { setPreset("custom"); setRange((r) => ({ ...r, to: e.target.value })); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
            />
          </label>
        </div>
        <div className="text-xs text-slate-500 mt-2">
          নির্বাচিত পরিসর: <span className="font-medium text-slate-700">{range.from}</span> থেকে <span className="font-medium text-slate-700">{range.to}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        {summary.map((s) => (
          <div key={s.label} className={`group relative overflow-hidden bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all ring-1 ${s.ring}`}>
            <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br ${s.grad} opacity-10 group-hover:opacity-20 blur-2xl transition`} />
            <div className="relative flex items-center gap-3">
              <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${s.grad} flex items-center justify-center shrink-0 shadow-lg`}>
                <s.Icon className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs text-slate-500 truncate font-medium">{s.label}</div>
                <div className={`text-base sm:text-xl font-extrabold bg-gradient-to-r ${s.grad} bg-clip-text text-transparent truncate`}>{s.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-3 sm:p-5 border border-slate-200 shadow-sm mb-4 sm:mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
            {periodLabel} আয়-ব্যয় তুলনা
          </h3>
        </div>
        {q.isLoading ? (
          <div className="text-center text-slate-500 py-12">লোড হচ্ছে...</div>
        ) : rows.length === 0 ? (
          <div className="text-center text-slate-500 py-12">কোনো তথ্য নেই</div>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="flex items-end gap-2 sm:gap-3 h-56 sm:h-64 px-2 sm:px-4 relative"
              style={{ minWidth: `${Math.max(420, rows.length * 56)}px` }}
            >
              <div className="absolute inset-0 pointer-events-none flex flex-col justify-between pb-6">
                {[0,1,2,3].map(i => <div key={i} className="border-t border-dashed border-slate-100" />)}
              </div>
              {rows.map((r) => (
                <div key={r.key} className="relative flex-1 flex flex-col items-center gap-2 min-w-[40px] group">
                  <div className="flex items-end gap-1 h-44 sm:h-52 w-full justify-center">
                    <div className="w-2.5 sm:w-4 rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-md shadow-emerald-200 transition-all group-hover:scale-y-105 origin-bottom" style={{ height: `${(r.income / max) * 100}%` }} title={`আয়: ${fmtTk(r.income)}`}></div>
                    <div className="w-2.5 sm:w-4 rounded-t-md bg-gradient-to-t from-rose-600 to-pink-400 shadow-md shadow-rose-200 transition-all group-hover:scale-y-105 origin-bottom" style={{ height: `${(r.expense / max) * 100}%` }} title={`ব্যয়: ${fmtTk(r.expense)}`}></div>
                    <div className="w-2.5 sm:w-4 rounded-t-md bg-gradient-to-t from-blue-600 to-sky-400 shadow-md shadow-sky-200 transition-all group-hover:scale-y-105 origin-bottom" style={{ height: `${(Math.max(0, r.saving) / max) * 100}%` }} title={`অবশিষ্ট: ${fmtTk(r.saving)}`}></div>
                  </div>
                  <span className="text-[10px] sm:text-xs text-slate-600 truncate w-full text-center font-medium group-hover:text-indigo-600 transition">{r.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mt-4 text-xs text-slate-600 font-medium">
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-gradient-to-t from-emerald-600 to-emerald-400"></span>আয়</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-gradient-to-t from-rose-600 to-pink-400"></span>ব্যয়</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-gradient-to-t from-blue-600 to-sky-400"></span>অবশিষ্ট</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-3 sm:p-5 border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span className="w-1.5 h-5 rounded-full bg-gradient-to-b from-emerald-500 to-teal-600" />
          {periodLabel} বিস্তারিত
        </h3>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {rows.map((r) => (
            <div key={r.key} className="bg-gradient-to-r from-slate-50 to-white rounded-xl p-3 border border-slate-100 hover:border-indigo-200 transition">
              <div className="font-medium text-slate-800 mb-2">{r.label}</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><div className="text-slate-500">আয়</div><div className="text-emerald-600 font-semibold">{fmtTk(r.income)}</div></div>
                <div><div className="text-slate-500">ব্যয়</div><div className="text-rose-500 font-semibold">{fmtTk(r.expense)}</div></div>
                <div><div className="text-slate-500">অবশিষ্ট</div><div className="text-blue-600 font-semibold">{fmtTk(r.saving)}</div></div>
              </div>
            </div>
          ))}
          <div className="bg-gradient-to-r from-indigo-50 via-violet-50 to-fuchsia-50 rounded-xl p-3 border border-indigo-200">
            <div className="font-bold text-indigo-800 mb-2">মোট</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><div className="text-slate-500">আয়</div><div className="text-emerald-700 font-bold">{fmtTk(totals.income)}</div></div>
              <div><div className="text-slate-500">ব্যয়</div><div className="text-rose-600 font-bold">{fmtTk(totals.expense)}</div></div>
              <div><div className="text-slate-500">অবশিষ্ট</div><div className="text-blue-700 font-bold">{fmtTk(totals.saving)}</div></div>
            </div>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600 bg-gradient-to-r from-slate-50 to-indigo-50/40 border-b border-slate-200">
                <th className="py-3 px-3 rounded-l-lg font-semibold">{colHeader}</th>
                <th className="py-3 px-3 text-right font-semibold">আয়</th>
                <th className="py-3 px-3 text-right font-semibold">ব্যয়</th>
                <th className="py-3 px-3 text-right rounded-r-lg font-semibold">অবশিষ্ট</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-slate-100 hover:bg-indigo-50/30 transition">
                  <td className="py-3 px-3 font-medium text-slate-800">{r.label}</td>
                  <td className="py-3 px-3 text-right text-emerald-600 font-semibold">{fmtTk(r.income)}</td>
                  <td className="py-3 px-3 text-right text-rose-500 font-semibold">{fmtTk(r.expense)}</td>
                  <td className="py-3 px-3 text-right text-blue-600 font-semibold">{fmtTk(r.saving)}</td>
                </tr>
              ))}
              <tr className="bg-gradient-to-r from-indigo-50 via-violet-50 to-fuchsia-50">
                <td className="py-3 px-3 font-bold text-indigo-800 rounded-l-lg">মোট</td>
                <td className="py-3 px-3 text-right text-emerald-700 font-extrabold">{fmtTk(totals.income)}</td>
                <td className="py-3 px-3 text-right text-rose-600 font-extrabold">{fmtTk(totals.expense)}</td>
                <td className="py-3 px-3 text-right text-blue-700 font-extrabold rounded-r-lg">{fmtTk(totals.saving)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
