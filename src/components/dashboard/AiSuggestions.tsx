import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, AlertTriangle, Lightbulb, TrendingUp, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getAiSuggestions, type AiSuggestion } from "@/lib/ai-suggestions.functions";

type Props = {
  curIncome: number;
  curExpense: number;
  prevIncome: number;
  prevExpense: number;
  receivable: number;
  payable: number;
  expenseByCategory: { category: string; amount: number }[];
  incomeByCategory: { category: string; amount: number }[];
  goals: { label: string; target: number; current: number }[];
  monthLabel: string;
};

const styles = {
  alert: { icon: AlertTriangle, ring: "border-rose-200", bg: "bg-rose-50", fg: "text-rose-600", chip: "bg-rose-100 text-rose-700", label: "সতর্কতা" },
  tip: { icon: Lightbulb, ring: "border-amber-200", bg: "bg-amber-50", fg: "text-amber-600", chip: "bg-amber-100 text-amber-700", label: "পরামর্শ" },
  invest: { icon: TrendingUp, ring: "border-emerald-200", bg: "bg-emerald-50", fg: "text-emerald-600", chip: "bg-emerald-100 text-emerald-700", label: "বিনিয়োগ" },
} as const;

export function AiSuggestions(props: Props) {
  const callAi = useServerFn(getAiSuggestions);
  const [items, setItems] = useState<AiSuggestion[] | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const res = await callAi({ data: props });
      setItems(res.suggestions);
      if (res.suggestions.length === 0) toast.message("কোনো সাজেশন পাওয়া যায়নি");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI সাজেশন আনতে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 rounded-xl p-4 sm:p-5 border border-indigo-200 mb-4 sm:mb-6">
      <div className="flex items-start sm:items-center justify-between gap-3 mb-3 flex-col sm:flex-row">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">AI আর্থিক সাজেশন</h3>
            <p className="text-xs text-slate-500">আপনার লেনদেন বিশ্লেষণ করে সতর্কতা ও পরামর্শ</p>
          </div>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : items ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
          {loading ? "বিশ্লেষণ চলছে..." : items ? "আবার বিশ্লেষণ" : "AI বিশ্লেষণ করুন"}
        </button>
      </div>

      {!items && !loading && (
        <div className="text-sm text-slate-500 bg-white/60 rounded-lg p-3 border border-dashed border-indigo-200">
          "AI বিশ্লেষণ করুন" চাপুন — কোন খাতে বেশি ব্যয় হচ্ছে, কোথায় সাশ্রয় ও বিনিয়োগ সম্ভব তা জানতে পারবেন।
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-white/60 border border-slate-200 animate-pulse" />
          ))}
        </div>
      )}

      {items && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((s, i) => {
            const style = styles[s.type] ?? styles.tip;
            const Icon = style.icon;
            return (
              <div key={i} className={`rounded-lg p-3 bg-white border ${style.ring}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full ${style.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${style.fg}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${style.chip}`}>{style.label}</span>
                      <h4 className="font-semibold text-slate-800 text-sm">{s.title}</h4>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{s.detail}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
