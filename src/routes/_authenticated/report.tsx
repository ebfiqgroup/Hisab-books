import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { AppShell } from "@/components/AppShell";
import { fmtTk, toBn, BN_MONTHS } from "@/lib/finance";
import { Download, BarChart3, TrendingUp, TrendingDown, PiggyBank, Calendar, ChevronDown, Printer, FileText, Hash } from "lucide-react";
import { toast } from "sonner";
import type { DateGranularity } from "@/components/DateRangeFilter";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/report")({
  head: () => ({
    meta: [
      { title: "রিপোর্ট - হিসাব বই" },
      { name: "description", content: "মাসিক আর্থিক রিপোর্ট ও বিশ্লেষণ" },
    ],
  }),
  component: ReportPage,
});

type Txn = { type: "income" | "expense"; amount: number; occurred_on: string; category: string };
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
  const { user } = useAuth();
  const [preset, setPreset] = useState<Preset>("6m");
  const [range, setRange] = useState(() => presetRange("6m"));
  const [menuOpen, setMenuOpen] = useState(false);
  const [granularityOverride, setGranularityOverride] = useState<DateGranularity>("auto");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [reportNo] = useState(() => `RPT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.floor(Math.random() * 9000 + 1000)}`);
  const [reportNote, setReportNote] = useState("");

  // Month / Year quick pickers — drive the same range state as the presets.
  const now = new Date();
  const [monthSel, setMonthSel] = useState<string>("");
  const [yearSel, setYearSel] = useState<string>("");
  const years = Array.from({ length: 8 }, (_, i) => now.getFullYear() - i);

  const applyMonth = (m: string, y: string) => {
    const yy = Number(y || now.getFullYear());
    if (!m) {
      if (!y) return;
      setRange({ from: isoDay(new Date(yy, 0, 1)), to: isoDay(new Date(yy, 11, 31)) });
      setPreset("custom");
      return;
    }
    const mm = Number(m);
    setRange({ from: isoDay(new Date(yy, mm, 1)), to: isoDay(new Date(yy, mm + 1, 0)) });
    setPreset("custom");
  };

  const setPresetAndRange = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") setRange(presetRange(p));
  };

  const q = useQuery({
    queryKey: ["transactions", "report", uid, range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("type,amount,occurred_on,category")
        .eq("user_id", uid)
        .gte("occurred_on", range.from)
        .lte("occurred_on", range.to)
        .order("occurred_on", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Txn[];
    },
  });

  const catOptions = useMemo(() => {
    const s = new Set<string>();
    for (const t of q.data ?? []) if (t.category) s.add(t.category);
    return Array.from(s).sort();
  }, [q.data]);

  // Decide bucket granularity: daily if <= 62 days, else monthly.
  const { rows, granularity } = useMemo(() => {
    const from = new Date(range.from);
    const to = new Date(range.to);
    const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
    const auto: "day" | "week" | "month" | "year" = days <= 62 ? "day" : days <= 366 * 2 ? "month" : "year";
    const gran: "day" | "week" | "month" | "year" = granularityOverride === "auto" ? auto : granularityOverride;
    const map = new Map<string, Row>();

    if (gran === "day") {
      for (let i = 0; i < days; i++) {
        const d = new Date(from);
        d.setDate(from.getDate() + i);
        const key = isoDay(d);
        map.set(key, { key, label: `${toBn(d.getDate())} ${BN_MONTHS[d.getMonth()].slice(0, 3)}`, income: 0, expense: 0, saving: 0 });
      }
    } else if (gran === "week") {
      // Bucket by ISO week start (Saturday-based to match BD convention)
      const startOfWeek = (d: Date) => {
        const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diffToSat = (x.getDay() + 1) % 7;
        x.setDate(x.getDate() - diffToSat);
        return x;
      };
      const cur = startOfWeek(from);
      const end = startOfWeek(to);
      while (cur <= end) {
        const key = isoDay(cur);
        const endOfWeek = new Date(cur); endOfWeek.setDate(cur.getDate() + 6);
        const label = `${toBn(cur.getDate())} ${BN_MONTHS[cur.getMonth()].slice(0, 3)} – ${toBn(endOfWeek.getDate())} ${BN_MONTHS[endOfWeek.getMonth()].slice(0, 3)}`;
        map.set(key, { key, label, income: 0, expense: 0, saving: 0 });
        cur.setDate(cur.getDate() + 7);
      }
    } else if (gran === "month") {
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
    } else {
      // year
      const startY = from.getFullYear();
      const endY = to.getFullYear();
      for (let y = startY; y <= endY; y++) {
        const key = String(y);
        map.set(key, { key, label: toBn(y), income: 0, expense: 0, saving: 0 });
      }
    }

    const source = (q.data ?? []).filter((t) => catFilter === "all" || t.category === catFilter);
    for (const t of source) {
      const d = new Date(t.occurred_on);
      let key: string;
      if (gran === "day") key = isoDay(d);
      else if (gran === "week") {
        const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diffToSat = (x.getDay() + 1) % 7;
        x.setDate(x.getDate() - diffToSat);
        key = isoDay(x);
      }
      else if (gran === "month") key = `${d.getFullYear()}-${d.getMonth()}`;
      else key = String(d.getFullYear());
      const r = map.get(key);
      if (!r) continue;
      if (t.type === "income") r.income += Number(t.amount);
      else r.expense += Number(t.amount);
    }
    const rows = Array.from(map.values()).map((r) => ({ ...r, saving: r.income - r.expense }));
    return { rows, granularity: gran };
  }, [q.data, range.from, range.to, granularityOverride, catFilter]);

  const max = Math.max(1, ...rows.flatMap((r) => [r.income, r.expense, Math.abs(r.saving)]));
  const totals = rows.reduce(
    (a, r) => ({ income: a.income + r.income, expense: a.expense + r.expense, saving: a.saving + r.saving }),
    { income: 0, expense: 0, saving: 0 },
  );
  const nonEmpty = rows.filter((r) => r.income || r.expense);
  const scoped = useMemo(
    () => (q.data ?? []).filter((tx) => catFilter === "all" || tx.category === catFilter),
    [q.data, catFilter],
  );
  const txnCount = scoped.length;
  const grandTotal = totals.income + totals.expense;
  const avgTxn = txnCount ? grandTotal / txnCount : 0;
  const catTotals = useMemo(() => {
    const map = new Map<string, { income: number; expense: number; count: number }>();
    for (const tx of scoped) {
      const k = tx.category || "—";
      const cur = map.get(k) ?? { income: 0, expense: 0, count: 0 };
      if (tx.type === "income") cur.income += Number(tx.amount);
      else cur.expense += Number(tx.amount);
      cur.count += 1;
      map.set(k, cur);
    }
    return Array.from(map.entries())
      .map(([category, v]) => ({ category, ...v, net: v.income - v.expense }))
      .sort((a, b) => b.income + b.expense - (a.income + a.expense));
  }, [scoped]);
  const periodLabel = granularity === "day" ? "দৈনিক" : granularity === "week" ? "সাপ্তাহিক" : granularity === "month" ? "মাসিক" : "বার্ষিক";
  const unitLabel = granularity === "day" ? "দিন" : granularity === "week" ? "সপ্তাহ" : granularity === "month" ? "মাস" : "বছর";

  const summary = [
    { label: `গড় ${periodLabel} আয়`, value: fmtTk(nonEmpty.length ? totals.income / nonEmpty.length : 0), Icon: TrendingUp, grad: "from-emerald-500 to-teal-600", ring: "ring-emerald-200" },
    { label: `গড় ${periodLabel} ব্যয়`, value: fmtTk(nonEmpty.length ? totals.expense / nonEmpty.length : 0), Icon: TrendingDown, grad: "from-rose-500 to-pink-600", ring: "ring-rose-200" },
    { label: `গড় ${periodLabel} অবশিষ্ট`, value: fmtTk(nonEmpty.length ? totals.saving / nonEmpty.length : 0), Icon: PiggyBank, grad: "from-sky-500 to-blue-600", ring: "ring-sky-200" },
    { label: "মোট রিপোর্ট", value: `${toBn(nonEmpty.length)} ${unitLabel}`, Icon: BarChart3, grad: "from-indigo-500 to-violet-600", ring: "ring-indigo-200" },
  ];

  const colHeader = granularity === "day" ? "তারিখ" : granularity === "week" ? "সপ্তাহ" : granularity === "month" ? "মাস" : "বছর";

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

  // Invoice-style, A4-optimised, print/PDF-ready document. Browsers save this
  // as a high-quality vector PDF via the print dialog (Bengali text stays crisp,
  // unlike a canvas rasteriser), with automatic page breaks and page numbers.
  const buildInvoiceHtml = (orientation: "portrait" | "landscape") => {
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    const genDate = new Date();
    const rowsHtml = rows.map((r, i) => `
      <tr>
        <td class="c">${toBn(i + 1)}</td>
        <td>${esc(r.label)}</td>
        <td class="r pos">${esc(fmtTk(r.income))}</td>
        <td class="r neg">${esc(fmtTk(r.expense))}</td>
        <td class="r net">${esc(fmtTk(r.saving))}</td>
      </tr>`).join("");
    const catHtml = catTotals.map((c) => `
      <tr>
        <td>${esc(c.category)}</td>
        <td class="c">${toBn(c.count)}</td>
        <td class="r pos">${esc(fmtTk(c.income))}</td>
        <td class="r neg">${esc(fmtTk(c.expense))}</td>
        <td class="r net">${esc(fmtTk(c.net))}</td>
      </tr>`).join("");

    return `<!doctype html><html lang="bn"><head><meta charset="utf-8">
<title>হিসাব বই — আর্থিক রিপোর্ট ${reportNo}</title>
<style>
  @page { size: A4 ${orientation}; margin: 14mm 12mm 18mm; }
  *{box-sizing:border-box}
  body{font-family:"Noto Sans Bengali",system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a;margin:0;font-size:12px;line-height:1.5}
  .sheet{padding:0}
  .head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px solid #4f46e5;padding-bottom:12px;margin-bottom:14px}
  .brand{display:flex;gap:10px;align-items:center}
  .brand img{width:46px;height:46px;object-fit:contain}
  .brand .n{font-size:19px;font-weight:800;letter-spacing:-.2px}
  .brand .s{font-size:10.5px;color:#64748b}
  .doc{text-align:right}
  .doc .t{font-size:17px;font-weight:800;color:#4338ca;text-transform:uppercase;letter-spacing:.5px}
  .doc .m{font-size:10.5px;color:#475569;margin-top:2px}
  .metagrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}
  .metagrid .b{border:1px solid #e2e8f0;border-radius:6px;padding:7px 9px;background:#f8fafc}
  .metagrid .l{font-size:9px;text-transform:uppercase;letter-spacing:.4px;color:#64748b;font-weight:700}
  .metagrid .v{font-size:11.5px;font-weight:700;margin-top:2px}
  h2{font-size:12.5px;margin:16px 0 7px;color:#1e293b;border-left:4px solid #6366f1;padding-left:7px}
  table{width:100%;border-collapse:collapse;font-size:11.5px}
  thead{display:table-header-group}
  tr{page-break-inside:avoid}
  th,td{padding:6px 8px;border-bottom:1px solid #e6e9ef}
  th{background:#eef2ff;color:#3730a3;font-weight:700;text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px}
  td.r,th.r{text-align:right}
  td.c,th.c{text-align:center}
  .pos{color:#047857;font-weight:600}
  .neg{color:#be123c;font-weight:600}
  .net{color:#1d4ed8;font-weight:600}
  tr.total td{font-weight:800;background:#eef2ff;color:#312e81;border-top:2px solid #6366f1}
  .sum{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}
  .sum .c1{border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px}
  .sum .l{font-size:9px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:.4px}
  .sum .v{font-size:13px;font-weight:800;margin-top:2px}
  .grand{margin-top:12px;border:2px solid #4f46e5;border-radius:8px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;background:#f5f3ff}
  .grand .l{font-size:11px;font-weight:700;color:#4338ca;text-transform:uppercase;letter-spacing:.5px}
  .grand .v{font-size:18px;font-weight:800;color:#312e81}
  .notes{margin-top:14px;border:1px dashed #cbd5e1;border-radius:6px;padding:9px 11px;min-height:46px}
  .notes .l{font-size:9px;text-transform:uppercase;color:#64748b;font-weight:700;letter-spacing:.4px;margin-bottom:3px}
  .sig{display:flex;justify-content:space-between;gap:28px;margin-top:34px;page-break-inside:avoid}
  .sig .box{flex:1;text-align:center}
  .sig .line{border-top:1.5px solid #94a3b8;margin-bottom:5px}
  .sig .cap{font-size:10px;color:#475569;font-weight:600}
  .foot{margin-top:18px;border-top:1px solid #e2e8f0;padding-top:7px;font-size:9.5px;color:#94a3b8;display:flex;justify-content:space-between}
  @media print{ .noprint{display:none!important} }
  .noprint{position:fixed;top:8px;right:8px;display:flex;gap:6px;z-index:9}
  .noprint button{padding:7px 13px;border-radius:6px;border:0;background:#4f46e5;color:#fff;font-size:12px;cursor:pointer;font-family:inherit}
</style></head><body>
<div class="noprint">
  <button onclick="window.print()">PDF / প্রিন্ট</button>
  <button style="background:#64748b" onclick="window.close()">বন্ধ</button>
</div>
<div class="sheet">
  <div class="head">
    <div class="brand">
      <img src="${window.location.origin}/logo-moneybag.png" alt="হিসাব বই লোগো" />
      <div>
        <div class="n">হিসাব বই</div>
        <div class="s">ব্যক্তিগত আর্থিক ব্যবস্থাপনা প্ল্যাটফর্ম</div>
      </div>
    </div>
    <div class="doc">
      <div class="t">আর্থিক রিপোর্ট</div>
      <div class="m">রিপোর্ট নম্বর: <strong>${esc(reportNo)}</strong></div>
      <div class="m">তৈরির তারিখ: ${esc(toBn(genDate.toLocaleDateString("en-GB")))}</div>
      <div class="m">তৈরির সময়: ${esc(toBn(genDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })))}</div>
    </div>
  </div>

  <div class="metagrid">
    <div class="b"><div class="l">ক্যাটাগরি</div><div class="v">${esc(catFilter === "all" ? "সব ক্যাটাগরি" : catFilter)}</div></div>
    <div class="b"><div class="l">তারিখ পরিসর</div><div class="v">${esc(toBn(range.from))} → ${esc(toBn(range.to))}</div></div>
    <div class="b"><div class="l">ভিউ / গ্রুপিং</div><div class="v">${esc(periodLabel)}</div></div>
    <div class="b"><div class="l">প্রস্তুতকারী</div><div class="v">${esc(user?.email ?? "হিসাব বই ব্যবহারকারী")}</div></div>
  </div>

  <h2>${esc(periodLabel)} বিস্তারিত বিবরণী</h2>
  <table>
    <thead><tr>
      <th class="c" style="width:36px">ক্রম</th><th>${esc(colHeader)}</th>
      <th class="r">আয়</th><th class="r">ব্যয়</th><th class="r">অবশিষ্ট</th>
    </tr></thead>
    <tbody>
      ${rowsHtml}
      <tr class="total">
        <td class="c">—</td><td>সর্বমোট</td>
        <td class="r">${esc(fmtTk(totals.income))}</td>
        <td class="r">${esc(fmtTk(totals.expense))}</td>
        <td class="r">${esc(fmtTk(totals.saving))}</td>
      </tr>
    </tbody>
  </table>

  ${catTotals.length ? `<h2>ক্যাটাগরি ভিত্তিক হিসাব</h2>
  <table>
    <thead><tr><th>ক্যাটাগরি</th><th class="c">লেনদেন</th><th class="r">আয়</th><th class="r">ব্যয়</th><th class="r">নিট</th></tr></thead>
    <tbody>${catHtml}</tbody>
  </table>` : ""}

  <h2>সারসংক্ষেপ</h2>
  <div class="sum">
    <div class="c1"><div class="l">মোট আয়</div><div class="v pos">${esc(fmtTk(totals.income))}</div></div>
    <div class="c1"><div class="l">মোট ব্যয়</div><div class="v neg">${esc(fmtTk(totals.expense))}</div></div>
    <div class="c1"><div class="l">মোট ব্যালেন্স</div><div class="v net">${esc(fmtTk(totals.saving))}</div></div>
    <div class="c1"><div class="l">লেনদেন সংখ্যা</div><div class="v">${esc(toBn(txnCount))}</div></div>
    <div class="c1"><div class="l">গড় ${esc(periodLabel)} আয়</div><div class="v">${esc(fmtTk(nonEmpty.length ? totals.income / nonEmpty.length : 0))}</div></div>
    <div class="c1"><div class="l">গড় ${esc(periodLabel)} ব্যয়</div><div class="v">${esc(fmtTk(nonEmpty.length ? totals.expense / nonEmpty.length : 0))}</div></div>
    <div class="c1"><div class="l">গড় প্রতি লেনদেন</div><div class="v">${esc(fmtTk(avgTxn))}</div></div>
    <div class="c1"><div class="l">${esc(colHeader)} সংখ্যা</div><div class="v">${esc(toBn(nonEmpty.length))}</div></div>
  </div>

  <div class="grand">
    <div class="l">সর্বমোট লেনদেন মূল্য (আয় + ব্যয়)</div>
    <div class="v">${esc(fmtTk(grandTotal))}</div>
  </div>

  <div class="notes"><div class="l">নোট</div>${esc(reportNote || "—")}</div>

  <div class="sig">
    <div class="box"><div class="line"></div><div class="cap">প্রস্তুতকারীর স্বাক্ষর</div></div>
    <div class="box"><div class="line"></div><div class="cap">পরীক্ষকের স্বাক্ষর</div></div>
    <div class="box"><div class="line"></div><div class="cap">অনুমোদনকারীর স্বাক্ষর</div></div>
  </div>

  <div class="foot">
    <span>হিসাব বই · স্বয়ংক্রিয়ভাবে তৈরি রিপোর্ট · ${esc(reportNo)}</span>
    <span>পরিসর: ${esc(toBn(range.from))} – ${esc(toBn(range.to))}</span>
  </div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print()},350)}</script>
</body></html>`;
  };

  const openInvoice = (orientation: "portrait" | "landscape") => {
    const w = window.open("", "_blank", "width=980,height=760");
    if (!w) { toast.error("পপ-আপ ব্লক করা হয়েছে — অনুমতি দিন"); return; }
    w.document.open();
    w.document.write(buildInvoiceHtml(orientation));
    w.document.close();
    toast.success(orientation === "portrait" ? "A4 পোর্ট্রেট রিপোর্ট তৈরি হয়েছে" : "A4 ল্যান্ডস্কেপ রিপোর্ট তৈরি হয়েছে");
  };
  const printReport = () => openInvoice("portrait");

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

      {/* Download / Print Actions */}
      <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6">
        <button
          onClick={printReport}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:border-indigo-300 shadow-sm"
        >
          <Printer className="w-4 h-4" />
          <span className="hidden sm:inline">প্রিন্ট</span>
        </button>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg text-sm font-medium hover:from-indigo-700 hover:to-violet-700 shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">ডাউনলোড</span>
            <ChevronDown className="w-4 h-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute left-0 mt-2 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
                <button
                  onClick={() => { setMenuOpen(false); downloadCsv(); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between"
                >
                  <span>সিএসভি ফাইল</span>
                  <span className="text-xs text-slate-400">.csv</span>
                </button>
                <button
                  onClick={() => { setMenuOpen(false); downloadXlsx(); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between border-t border-slate-100"
                >
                  <span>এক্সেল ফাইল</span>
                  <span className="text-xs text-slate-400">.xlsx</span>
                </button>
              </div>
            </>
          )}
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
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">ক্যাটাগরি ফিল্টার</div>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="w-full sm:w-72 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">সব ক্যাটাগরি</option>
            {catOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {catFilter !== "all" && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 font-semibold">{catFilter}</span>
              <span className="text-emerald-600 font-semibold">আয়: {fmtTk(totals.income)}</span>
              <span className="text-rose-600 font-semibold">ব্যয়: {fmtTk(totals.expense)}</span>
              <span className="text-blue-600 font-semibold">সর্বমোট অবশিষ্ট: {fmtTk(totals.saving)}</span>
              <button onClick={() => setCatFilter("all")} className="text-slate-500 underline">রিসেট</button>
            </div>
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">ভিউ অপশন (গ্রুপিং)</div>
          <div className="flex flex-wrap gap-1.5">
            {([
              { k: "auto", bn: "অটো" },
              { k: "day", bn: "দিন" },
              { k: "week", bn: "সপ্তাহ" },
              { k: "month", bn: "মাস" },
              { k: "year", bn: "বছর" },
            ] as { k: DateGranularity; bn: string }[]).map((g) => (
              <button
                key={g.k}
                onClick={() => setGranularityOverride(g.k)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  granularityOverride === g.k
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-indigo-600 shadow-md shadow-indigo-200"
                    : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40"
                }`}
              >
                {g.bn}
              </button>
            ))}
          </div>
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
