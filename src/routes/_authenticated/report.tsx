import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { fmtTk, toBn, BN_MONTHS } from "@/lib/finance";
import { Download, BarChart3, TrendingUp, TrendingDown, PiggyBank } from "lucide-react";
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

function ReportPage() {
  const q = useQuery({
    queryKey: ["transactions", "report"],
    queryFn: async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - 11);
      since.setDate(1);
      const { data, error } = await supabase
        .from("transactions")
        .select("type,amount,occurred_on")
        .gte("occurred_on", since.toISOString().slice(0, 10))
        .order("occurred_on", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Txn[];
    },
  });

  const rows: Row[] = useMemo(() => {
    const map = new Map<string, Row>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      map.set(key, { key, label: BN_MONTHS[d.getMonth()], income: 0, expense: 0, saving: 0 });
    }
    for (const t of q.data ?? []) {
      const d = new Date(t.occurred_on);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const r = map.get(key);
      if (!r) continue;
      if (t.type === "income") r.income += Number(t.amount);
      else r.expense += Number(t.amount);
    }
    return Array.from(map.values()).map((r) => ({ ...r, saving: r.income - r.expense }));
  }, [q.data]);

  const max = Math.max(1, ...rows.flatMap((r) => [r.income, r.expense, Math.abs(r.saving)]));
  const nonEmpty = rows.filter((r) => r.income || r.expense);
  const avg = (k: "income" | "expense" | "saving") =>
    nonEmpty.length ? nonEmpty.reduce((s, r) => s + r[k], 0) / nonEmpty.length : 0;

  const summary = [
    { label: "গড় মাসিক আয়", value: fmtTk(avg("income")), Icon: TrendingUp, fg: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "গড় মাসিক ব্যয়", value: fmtTk(avg("expense")), Icon: TrendingDown, fg: "text-rose-500", bg: "bg-rose-50" },
    { label: "গড় মাসিক সঞ্চয়", value: fmtTk(avg("saving")), Icon: PiggyBank, fg: "text-blue-600", bg: "bg-blue-50" },
    { label: "মোট রিপোর্ট", value: `${toBn(nonEmpty.length)} মাস`, Icon: BarChart3, fg: "text-indigo-600", bg: "bg-indigo-50" },
  ];

  const downloadCsv = () => {
    const header = "মাস,আয়,ব্যয়,সঞ্চয়\n";
    const body = rows.map((r) => `${r.label},${Math.round(r.income)},${Math.round(r.expense)},${Math.round(r.saving)}`).join("\n");
    const blob = new Blob(["\uFEFF" + header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("রিপোর্ট ডাউনলোড হয়েছে");
  };

  return (
    <AppShell title="রিপোর্ট প্লাটফর্ম" actions={
      <button onClick={downloadCsv} className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
        <span className="hidden sm:inline">রিপোর্ট ডাউনলোড</span>
        <Download className="w-4 h-4" />
      </button>
    }>
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
        <h3 className="font-bold text-slate-800 mb-4">মাসিক আয়-ব্যয় তুলনা</h3>
        {q.isLoading ? (
          <div className="text-center text-slate-500 py-12">লোড হচ্ছে...</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-3 sm:gap-6 h-56 sm:h-64 px-2 sm:px-4 min-w-[420px]">
              {rows.map((r) => (
                <div key={r.key} className="flex-1 flex flex-col items-center gap-2">
                  <div className="flex items-end gap-1 h-44 sm:h-52 w-full justify-center">
                    <div className="w-3 sm:w-5 bg-emerald-500 rounded-t" style={{ height: `${(r.income / max) * 100}%` }} title={`আয়: ${fmtTk(r.income)}`}></div>
                    <div className="w-3 sm:w-5 bg-rose-500 rounded-t" style={{ height: `${(r.expense / max) * 100}%` }} title={`ব্যয়: ${fmtTk(r.expense)}`}></div>
                    <div className="w-3 sm:w-5 bg-blue-500 rounded-t" style={{ height: `${(Math.max(0, r.saving) / max) * 100}%` }} title={`সঞ্চয়: ${fmtTk(r.saving)}`}></div>
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
          <span className="flex items-center gap-2"><span className="w-3 h-3 bg-blue-500 rounded"></span>সঞ্চয়</span>
        </div>
      </div>

      <div className="bg-white rounded-xl p-3 sm:p-5 border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-4">মাসিক বিস্তারিত</h3>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {rows.map((r) => (
            <div key={r.key} className="bg-slate-50 rounded-lg p-3">
              <div className="font-medium text-slate-800 mb-2">{r.label}</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><div className="text-slate-500">আয়</div><div className="text-emerald-600 font-semibold">{fmtTk(r.income)}</div></div>
                <div><div className="text-slate-500">ব্যয়</div><div className="text-rose-500 font-semibold">{fmtTk(r.expense)}</div></div>
                <div><div className="text-slate-500">সঞ্চয়</div><div className="text-blue-600 font-semibold">{fmtTk(r.saving)}</div></div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2.5">মাস</th>
                <th className="py-2.5 text-right">আয়</th>
                <th className="py-2.5 text-right">ব্যয়</th>
                <th className="py-2.5 text-right">সঞ্চয়</th>
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
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
