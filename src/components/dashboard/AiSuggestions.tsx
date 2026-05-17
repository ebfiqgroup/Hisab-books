import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, AlertTriangle, Lightbulb, TrendingUp, RefreshCw, Loader2, Settings2, X, Zap } from "lucide-react";
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
  budgets?: { category: string; limit: number; spent: number }[];
  monthLabel: string;
};

const styles = {
  alert: { icon: AlertTriangle, ring: "border-rose-200", bg: "bg-rose-50", fg: "text-rose-600", chip: "bg-rose-100 text-rose-700", label: "সতর্কতা" },
  tip: { icon: Lightbulb, ring: "border-amber-200", bg: "bg-amber-50", fg: "text-amber-600", chip: "bg-amber-100 text-amber-700", label: "পরামর্শ" },
  invest: { icon: TrendingUp, ring: "border-emerald-200", bg: "bg-emerald-50", fg: "text-emerald-600", chip: "bg-emerald-100 text-emerald-700", label: "বিনিয়োগ" },
} as const;

type AlertType = "alert" | "tip" | "invest";
type AiConfig = {
  types: AlertType[];
  expenseRatioPct: number;
  lowCashTk: number;
  goalLagPct: number;
  autoRun: boolean;
  autoIntervalMin: number;
};

const DEFAULT_CFG: AiConfig = {
  types: ["alert", "tip", "invest"],
  expenseRatioPct: 80,
  lowCashTk: 5000,
  goalLagPct: 20,
  autoRun: true,
  autoIntervalMin: 30,
};
const STORAGE_KEY = "ai_alert_config_v1";

function loadCfg(): AiConfig {
  if (typeof window === "undefined") return DEFAULT_CFG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CFG;
    const p = JSON.parse(raw);
    return {
      types: Array.isArray(p.types) && p.types.length > 0 ? p.types : DEFAULT_CFG.types,
      expenseRatioPct: Number.isFinite(p.expenseRatioPct) ? p.expenseRatioPct : DEFAULT_CFG.expenseRatioPct,
      lowCashTk: Number.isFinite(p.lowCashTk) ? p.lowCashTk : DEFAULT_CFG.lowCashTk,
      goalLagPct: Number.isFinite(p.goalLagPct) ? p.goalLagPct : DEFAULT_CFG.goalLagPct,
      autoRun: typeof p.autoRun === "boolean" ? p.autoRun : DEFAULT_CFG.autoRun,
      autoIntervalMin: Number.isFinite(p.autoIntervalMin) && p.autoIntervalMin >= 5 ? p.autoIntervalMin : DEFAULT_CFG.autoIntervalMin,
    };
  } catch { return DEFAULT_CFG; }
}

export function AiSuggestions(props: Props) {
  const callAi = useServerFn(getAiSuggestions);
  const [items, setItems] = useState<AiSuggestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [cfg, setCfg] = useState<AiConfig>(DEFAULT_CFG);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const cfgRef = useRef(cfg);
  const propsRef = useRef(props);
  const loadingRef = useRef(false);
  useEffect(() => { cfgRef.current = cfg; }, [cfg]);
  useEffect(() => { propsRef.current = props; }, [props]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  useEffect(() => { setCfg(loadCfg()); }, []);

  const run = async (silent = false) => {
    const c = cfgRef.current;
    if (c.types.length === 0) {
      if (!silent) toast.error("অন্তত একটি অ্যালার্ট ধরন নির্বাচন করুন");
      return;
    }
    if (loadingRef.current) return;
    setLoading(true);
    try {
      const res = await callAi({ data: { ...propsRef.current, config: c } });
      setItems(res.suggestions);
      setLastRun(new Date());
      if (!silent && res.suggestions.length === 0) toast.message("কোনো সাজেশন পাওয়া যায়নি");
    } catch (e) {
      if (!silent) toast.error(e instanceof Error ? e.message : "AI সাজেশন আনতে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  // Automation: auto-run on mount + every N minutes when enabled
  const hasData = (props.curIncome + props.curExpense) > 0 || props.expenseByCategory.length > 0;
  const autoKey = `${cfg.autoRun}-${cfg.autoIntervalMin}-${hasData}`;
  useEffect(() => {
    if (!cfg.autoRun || !hasData) return;
    const t = setTimeout(() => { run(true); }, 1200);
    const iv = setInterval(() => { run(true); }, Math.max(5, cfg.autoIntervalMin) * 60 * 1000);
    return () => { clearTimeout(t); clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoKey]);

  const toggleType = (t: AlertType) => {
    setCfg((c) => ({ ...c, types: c.types.includes(t) ? c.types.filter((x) => x !== t) : [...c.types, t] }));
  };

  const saveCfg = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch { /* noop */ }
    setSettingsOpen(false);
    toast.success("সেটিংস সংরক্ষিত হয়েছে");
  };

  const resetCfg = () => setCfg(DEFAULT_CFG);

  return (
    <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 rounded-xl p-4 sm:p-5 border border-indigo-200 mb-4 sm:mb-6">
      <div className="flex items-start sm:items-center justify-between gap-3 mb-3 flex-col sm:flex-row">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">AI আর্থিক সাজেশন</h3>
            <p className="text-xs text-slate-500">
              {cfg.autoRun ? <>অটো-বিশ্লেষণ চালু • প্রতি {cfg.autoIntervalMin} মিনিটে</> : "ম্যানুয়াল বিশ্লেষণ"}
              {lastRun && <> • সর্বশেষ {lastRun.toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" })}</>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const next = { ...cfg, autoRun: !cfg.autoRun };
              setCfg(next);
              try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* noop */ }
              toast.success(next.autoRun ? "অটোমেশন চালু" : "অটোমেশন বন্ধ");
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border ${cfg.autoRun ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-slate-200 text-slate-600"}`}
            title="অটোমেশন"
          >
            <Zap className="w-4 h-4" /> অটো {cfg.autoRun ? "চালু" : "বন্ধ"}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-50"
            title="অ্যালার্ট সেটিংস"
          >
            <Settings2 className="w-4 h-4" /> সেটিংস
          </button>
          <button
            onClick={() => run(false)}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : items ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            {loading ? "বিশ্লেষণ চলছে..." : items ? "আবার বিশ্লেষণ" : "AI বিশ্লেষণ করুন"}
          </button>
        </div>
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

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSettingsOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-slate-800 flex items-center gap-2"><Settings2 className="w-4 h-4 text-indigo-600" /> AI অ্যালার্ট সেটিংস</h4>
              <button onClick={() => setSettingsOpen(false)} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-slate-700 mb-2">কোন ধরনের সমস্যা দেখাবে</div>
                <div className="space-y-2">
                  {(["alert", "tip", "invest"] as AlertType[]).map((t) => {
                    const st = styles[t];
                    const checked = cfg.types.includes(t);
                    const desc = t === "alert" ? "অতিরিক্ত খরচ, নগদ কম, লক্ষ্য পিছিয়ে" : t === "tip" ? "সাশ্রয় ও বাজেট পরামর্শ" : "সঞ্চয় ও বিনিয়োগ পরামর্শ";
                    return (
                      <label key={t} className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer ${checked ? st.ring + " " + st.bg : "border-slate-200 bg-white"}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleType(t)} className="mt-1" />
                        <div className="flex-1">
                          <div className={`text-sm font-semibold ${st.fg}`}>{st.label}</div>
                          <div className="text-xs text-slate-500">{desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 flex justify-between mb-1">
                  <span>বেশি খরচ থ্রেশহোল্ড</span>
                  <span className="text-indigo-600 font-semibold">{cfg.expenseRatioPct}% আয়ের</span>
                </label>
                <input type="range" min={20} max={150} step={5} value={cfg.expenseRatioPct}
                  onChange={(e) => setCfg({ ...cfg, expenseRatioPct: Number(e.target.value) })}
                  className="w-full accent-indigo-600" />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">নগদ কম থ্রেশহোল্ড (৳)</label>
                <input type="number" min={0} step={500} value={cfg.lowCashTk}
                  onChange={(e) => setCfg({ ...cfg, lowCashTk: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                <p className="text-xs text-slate-500 mt-1">অবশিষ্ট এর কম হলে অ্যালার্ট</p>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 flex justify-between mb-1">
                  <span>লক্ষ্য পিছিয়ে থ্রেশহোল্ড</span>
                  <span className="text-indigo-600 font-semibold">{cfg.goalLagPct}%</span>
                </label>
                <input type="range" min={5} max={60} step={5} value={cfg.goalLagPct}
                  onChange={(e) => setCfg({ ...cfg, goalLagPct: Number(e.target.value) })}
                  className="w-full accent-indigo-600" />
              </div>

              <div className="pt-3 border-t border-slate-100">
                <label className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-medium text-slate-700 flex items-center gap-2"><Zap className="w-4 h-4 text-emerald-600" /> অটোমেশন</span>
                  <input type="checkbox" checked={cfg.autoRun} onChange={(e) => setCfg({ ...cfg, autoRun: e.target.checked })} className="w-4 h-4 accent-emerald-600" />
                </label>
                <p className="text-xs text-slate-500 mb-2">চালু থাকলে ড্যাশবোর্ড খুললেই AI নিজে থেকে বিশ্লেষণ করে রিপোর্ট দেখাবে।</p>
                <label className="text-sm font-medium text-slate-700 flex justify-between mb-1">
                  <span>রিফ্রেশ ইন্টারভাল</span>
                  <span className="text-indigo-600 font-semibold">{cfg.autoIntervalMin} মিনিট</span>
                </label>
                <input type="range" min={5} max={120} step={5} value={cfg.autoIntervalMin}
                  disabled={!cfg.autoRun}
                  onChange={(e) => setCfg({ ...cfg, autoIntervalMin: Number(e.target.value) })}
                  className="w-full accent-indigo-600 disabled:opacity-50" />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 mt-5 pt-4 border-t border-slate-100">
              <button onClick={resetCfg} className="text-xs text-slate-500 hover:text-slate-700 underline">ডিফল্টে ফিরান</button>
              <div className="flex gap-2">
                <button onClick={() => setSettingsOpen(false)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg">বাতিল</button>
                <button onClick={saveCfg} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">সংরক্ষণ</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
