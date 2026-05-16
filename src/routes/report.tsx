import { createFileRoute } from "@tanstack/react-router";
import { Sidebar } from "@/components/Sidebar";
import { Download, BarChart3, TrendingUp, TrendingDown, PiggyBank } from "lucide-react";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "রিপোর্ট - আমার হিসাব" },
      { name: "description", content: "মাসিক আর্থিক রিপোর্ট ও বিশ্লেষণ" },
    ],
  }),
  component: ReportPage,
});

const months = [
  { m: "জানুয়ারি", income: "৬০,০০০", expense: "৩৫,০০০", saving: "২৫,০০০" },
  { m: "ফেব্রুয়ারি", income: "৬২,৫০০", expense: "৩৬,২০০", saving: "২৬,৩০০" },
  { m: "মার্চ", income: "৫৮,৩০০", expense: "৩৪,৬২০", saving: "২৩,৬৮০" },
  { m: "এপ্রিল", income: "৬১,২০০", expense: "৩৭,১০০", saving: "২৪,১০০" },
  { m: "মে", income: "৬৫,৪৫০", expense: "৩৮,৭৫০", saving: "২৬,৭০০" },
];

const summary = [
  { label: "গড় মাসিক আয়", value: "৳ ৬১,৪৯০", Icon: TrendingUp, fg: "text-emerald-600", bg: "bg-emerald-50" },
  { label: "গড় মাসিক ব্যয়", value: "৳ ৩৬,৩৩৪", Icon: TrendingDown, fg: "text-rose-500", bg: "bg-rose-50" },
  { label: "গড় মাসিক সঞ্চয়", value: "৳ ২৫,১৫৬", Icon: PiggyBank, fg: "text-blue-600", bg: "bg-blue-50" },
  { label: "মোট রিপোর্ট", value: "৫ মাস", Icon: BarChart3, fg: "text-indigo-600", bg: "bg-indigo-50" },
];

function ReportPage() {
  const max = 70000;
  return (
    <div className="min-h-screen flex" style={{ background: "oklch(0.97 0.005 250)" }}>
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-800">রিপোর্ট প্লাটফর্ম</h1>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">
            রিপোর্ট ডাউনলোড <Download className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {summary.map((s) => (
            <div key={s.label} className="bg-white rounded-xl p-5 border border-slate-200">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-full ${s.bg} flex items-center justify-center`}>
                  <s.Icon className={`w-5 h-5 ${s.fg}`} />
                </div>
                <div>
                  <div className="text-sm text-slate-500">{s.label}</div>
                  <div className={`text-xl font-bold ${s.fg}`}>{s.value}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 mb-6">
          <h3 className="font-bold text-slate-800 mb-4">মাসিক আয়-ব্যয় তুলনা</h3>
          <div className="flex items-end gap-6 h-64 px-4">
            {months.map((mo) => {
              const inc = parseInt(mo.income.replace(/[^\d]/g, ""));
              const exp = parseInt(mo.expense.replace(/[^\d]/g, ""));
              const sav = parseInt(mo.saving.replace(/[^\d]/g, ""));
              return (
                <div key={mo.m} className="flex-1 flex flex-col items-center gap-2">
                  <div className="flex items-end gap-1 h-52 w-full justify-center">
                    <div className="w-5 bg-emerald-500 rounded-t" style={{ height: `${(inc / max) * 100}%` }} title={`আয়: ৳${mo.income}`}></div>
                    <div className="w-5 bg-rose-500 rounded-t" style={{ height: `${(exp / max) * 100}%` }} title={`ব্যয়: ৳${mo.expense}`}></div>
                    <div className="w-5 bg-blue-500 rounded-t" style={{ height: `${(sav / max) * 100}%` }} title={`সঞ্চয়: ৳${mo.saving}`}></div>
                  </div>
                  <span className="text-xs text-slate-600">{mo.m}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 text-xs text-slate-600">
            <span className="flex items-center gap-2"><span className="w-3 h-3 bg-emerald-500 rounded"></span>আয়</span>
            <span className="flex items-center gap-2"><span className="w-3 h-3 bg-rose-500 rounded"></span>ব্যয়</span>
            <span className="flex items-center gap-2"><span className="w-3 h-3 bg-blue-500 rounded"></span>সঞ্চয়</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-4">মাসিক বিস্তারিত</h3>
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
              {months.map((mo) => (
                <tr key={mo.m} className="border-b border-slate-100">
                  <td className="py-3 font-medium text-slate-800">{mo.m}</td>
                  <td className="py-3 text-right text-emerald-600 font-medium">৳ {mo.income}</td>
                  <td className="py-3 text-right text-rose-500 font-medium">৳ {mo.expense}</td>
                  <td className="py-3 text-right text-blue-600 font-medium">৳ {mo.saving}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-center text-xs text-slate-500 mt-6">
          © ২০২৪ আমার হিসাব. সর্বস্বত্ব সংরক্ষিত. <span className="text-rose-500">♥</span>
        </div>
      </main>
    </div>
  );
}