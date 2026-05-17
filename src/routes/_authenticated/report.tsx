import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { fmtTk, toBn, BN_MONTHS } from "@/lib/finance";
import { Download, BarChart3, TrendingUp, TrendingDown, PiggyBank, Calendar, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

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
  const [preset, setPreset] = useState<Preset>("6m");
  const [range, setRange] = useState(() => presetRange("6m"));
  const [menuOpen, setMenuOpen] = useState(false);

  const setPresetAndRange = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") setRange(presetRange(p));
  };

  const q = useQuery({
    queryKey: ["transactions", "report", range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("type,amount,occurred_on")
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
    { label: `গড় ${periodLabel} আয়`, value: fmtTk(nonEmpty.length ? totals.income / nonEmpty.length : 0), Icon: TrendingUp, fg: "text-emerald-600", bg: "bg-emerald-50" },
    { label: `গড় ${periodLabel} ব্যয়`, value: fmtTk(nonEmpty.length ? totals.expense / nonEmpty.length : 0), Icon: TrendingDown, fg: "text-rose-500", bg: "bg-rose-50" },
    { label: `গড় ${periodLabel} অবশিষ্ট`, value: fmtTk(nonEmpty.length ? totals.saving / nonEmpty.length : 0), Icon: PiggyBank, fg: "text-blue-600", bg: "bg-blue-50" },
    { label: "মোট রিপোর্ট", value: `${toBn(nonEmpty.length)} ${unitLabel}`, Icon: BarChart3, fg: "text-indigo-600", bg: "bg-indigo-50" },
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

  const downloadXlsx = () => {
    const data = [
      [colHeader, "আয়", "ব্যয়", "অবশিষ্ট"],
      ...rows.map((r) => [r.label, Math.round(r.income), Math.round(r.expense), Math.round(r.saving)]),
      ["মোট", Math.round(totals.income), Math.round(totals.expense), Math.round(totals.saving)],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "রিপোর্ট");
    XLSX.writeFile(wb, `report-${range.from}_to_${range.to}.xlsx`);
    toast.success("XLSX রিপোর্ট ডাউনলোড হয়েছে");
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
    <AppShell title="রিপোর্ট প্লাটফর্ম" actions={
      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">ডাউনলোড</span>
          <ChevronDown className="w-4 h-4" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
              <button
                onClick={() => { setMenuOpen(false); downloadCsv(); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between"
              >
                <span>CSV ফাইল</span>
                <span className="text-xs text-slate-400">.csv</span>
              </button>
              <button
                onClick={() => { setMenuOpen(false); downloadXlsx(); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between border-t border-slate-100"
              >
                <span>Excel ফাইল</span>
                <span className="text-xs text-slate-400">.xlsx</span>
              </button>
            </div>
          </>
        )}
      </div>
    }>
      {/* Filter */}
      <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200 mb-4 sm:mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-indigo-600" />
          <h3 className="font-semibold text-slate-800 text-sm">সময় ফিল্টার</h3>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {presets.map((p) => (
            <button
              key={p.k}
              onClick={() => setPresetAndRange(p.k)}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border transition ${
                preset === p.k
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300"
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
          <div key={s.label} className="bg-white rounded-xl p-3 sm:p-5 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full ${s.bg} flex items-center justify-center shrink-0`}>
                <s.Icon className={`w-5 h-5 ${s.fg}`} />
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm text-slate-500 truncate">{s.label}</div>
                <div className={`text-base sm:text-xl font-bold ${s.fg} truncate`}>{s.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-3 sm:p-5 border border-slate-200 mb-4 sm:mb-6">
        <h3 className="font-bold text-slate-800 mb-4">{periodLabel} আয়-ব্যয় তুলনা</h3>
        {q.isLoading ? (
          <div className="text-center text-slate-500 py-12">লোড হচ্ছে...</div>
        ) : rows.length === 0 ? (
          <div className="text-center text-slate-500 py-12">কোনো তথ্য নেই</div>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="flex items-end gap-2 sm:gap-3 h-56 sm:h-64 px-2 sm:px-4"
              style={{ minWidth: `${Math.max(420, rows.length * 56)}px` }}
            >
              {rows.map((r) => (
                <div key={r.key} className="flex-1 flex flex-col items-center gap-2 min-w-[40px]">
                  <div className="flex items-end gap-1 h-44 sm:h-52 w-full justify-center">
                    <div className="w-2.5 sm:w-4 bg-emerald-500 rounded-t" style={{ height: `${(r.income / max) * 100}%` }} title={`আয়: ${fmtTk(r.income)}`}></div>
                    <div className="w-2.5 sm:w-4 bg-rose-500 rounded-t" style={{ height: `${(r.expense / max) * 100}%` }} title={`ব্যয়: ${fmtTk(r.expense)}`}></div>
                    <div className="w-2.5 sm:w-4 bg-blue-500 rounded-t" style={{ height: `${(Math.max(0, r.saving) / max) * 100}%` }} title={`অবশিষ্ট: ${fmtTk(r.saving)}`}></div>
                  </div>
                  <span className="text-[10px] sm:text-xs text-slate-600 truncate w-full text-center">{r.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mt-4 text-xs text-slate-600">
          <span className="flex items-center gap-2"><span className="w-3 h-3 bg-emerald-500 rounded"></span>আয়</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 bg-rose-500 rounded"></span>ব্যয়</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 bg-blue-500 rounded"></span>অবশিষ্ট</span>
        </div>
      </div>

      <div className="bg-white rounded-xl p-3 sm:p-5 border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-4">{periodLabel} বিস্তারিত</h3>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {rows.map((r) => (
            <div key={r.key} className="bg-slate-50 rounded-lg p-3">
              <div className="font-medium text-slate-800 mb-2">{r.label}</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><div className="text-slate-500">আয়</div><div className="text-emerald-600 font-semibold">{fmtTk(r.income)}</div></div>
                <div><div className="text-slate-500">ব্যয়</div><div className="text-rose-500 font-semibold">{fmtTk(r.expense)}</div></div>
                <div><div className="text-slate-500">অবশিষ্ট</div><div className="text-blue-600 font-semibold">{fmtTk(r.saving)}</div></div>
              </div>
            </div>
          ))}
          <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
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
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2.5">{colHeader}</th>
                <th className="py-2.5 text-right">আয়</th>
                <th className="py-2.5 text-right">ব্যয়</th>
                <th className="py-2.5 text-right">অবশিষ্ট</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-slate-100">
                  <td className="py-3 font-medium text-slate-800">{r.label}</td>
                  <td className="py-3 text-right text-emerald-600 font-medium">{fmtTk(r.income)}</td>
                  <td className="py-3 text-right text-rose-500 font-medium">{fmtTk(r.expense)}</td>
                  <td className="py-3 text-right text-blue-600 font-medium">{fmtTk(r.saving)}</td>
                </tr>
              ))}
              <tr className="bg-indigo-50">
                <td className="py-3 font-bold text-indigo-800">মোট</td>
                <td className="py-3 text-right text-emerald-700 font-bold">{fmtTk(totals.income)}</td>
                <td className="py-3 text-right text-rose-600 font-bold">{fmtTk(totals.expense)}</td>
                <td className="py-3 text-right text-blue-700 font-bold">{fmtTk(totals.saving)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
