import { useMemo } from "react";
import { Calendar, X } from "lucide-react";

export type DateView = "day" | "week" | "month" | "year" | "all" | "custom";
export type DateGranularity = "day" | "week" | "month" | "year" | "auto";

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function rangeForView(view: DateView, today: Date = new Date()): { from: string; to: string } {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (view === "all" || view === "custom") return { from: "", to: "" };
  if (view === "day") return { from: isoDay(t), to: isoDay(t) };
  if (view === "week") {
    // Week starts on Saturday (Bangladesh convention) — change to Sunday/Monday if preferred
    const day = t.getDay(); // 0=Sun..6=Sat
    const diffToSat = (day + 1) % 7; // days since last Sat
    const start = new Date(t); start.setDate(t.getDate() - diffToSat);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return { from: isoDay(start), to: isoDay(end) };
  }
  if (view === "month") {
    const s = new Date(t.getFullYear(), t.getMonth(), 1);
    const e = new Date(t.getFullYear(), t.getMonth() + 1, 0);
    return { from: isoDay(s), to: isoDay(e) };
  }
  // year
  const s = new Date(t.getFullYear(), 0, 1);
  const e = new Date(t.getFullYear(), 11, 31);
  return { from: isoDay(s), to: isoDay(e) };
}

type Props = {
  view: DateView;
  from: string;
  to: string;
  onChange: (next: { view: DateView; from: string; to: string }) => void;
  granularity?: DateGranularity;
  onGranularityChange?: (g: DateGranularity) => void;
  showGranularity?: boolean;
  accent?: "indigo" | "emerald" | "rose" | "violet" | "sky" | "amber";
  className?: string;
  compact?: boolean;
};

const accentMap = {
  indigo: { active: "bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-indigo-600 shadow-md shadow-indigo-200", ring: "focus:ring-indigo-500/30 focus:border-indigo-400", icon: "text-indigo-600" },
  emerald: { active: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-emerald-500 shadow-md shadow-emerald-200", ring: "focus:ring-emerald-500/30 focus:border-emerald-400", icon: "text-emerald-600" },
  rose: { active: "bg-gradient-to-r from-rose-500 to-pink-500 text-white border-rose-500 shadow-md shadow-rose-200", ring: "focus:ring-rose-500/30 focus:border-rose-400", icon: "text-rose-600" },
  violet: { active: "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white border-violet-600 shadow-md shadow-violet-200", ring: "focus:ring-violet-500/30 focus:border-violet-400", icon: "text-violet-600" },
  sky: { active: "bg-gradient-to-r from-sky-500 to-blue-500 text-white border-sky-500 shadow-md shadow-sky-200", ring: "focus:ring-sky-500/30 focus:border-sky-400", icon: "text-sky-600" },
  amber: { active: "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-500 shadow-md shadow-amber-200", ring: "focus:ring-amber-500/30 focus:border-amber-400", icon: "text-amber-600" },
};

export function DateRangeFilter({ view, from, to, onChange, granularity, onGranularityChange, showGranularity, accent = "indigo", className, compact }: Props) {
  const a = accentMap[accent];
  const presets: { k: DateView; bn: string; en: string }[] = useMemo(() => ([
    { k: "day", bn: "আজ", en: "Today" },
    { k: "week", bn: "এই সপ্তাহ", en: "This week" },
    { k: "month", bn: "এই মাস", en: "This month" },
    { k: "year", bn: "এই বছর", en: "This year" },
    { k: "all", bn: "সব", en: "All" },
    { k: "custom", bn: "কাস্টম", en: "Custom" },
  ]), []);

  const setView = (v: DateView) => {
    if (v === "custom") {
      onChange({ view: "custom", from: from || isoDay(new Date()), to: to || isoDay(new Date()) });
    } else {
      const r = rangeForView(v);
      onChange({ view: v, from: r.from, to: r.to });
    }
  };

  const setFrom = (v: string) => onChange({ view: "custom", from: v, to });
  const setTo = (v: string) => onChange({ view: "custom", from, to: v });
  const clear = () => onChange({ view: "all", from: "", to: "" });

  return (
    <div className={`bg-white rounded-2xl ${compact ? "p-2.5" : "p-3 sm:p-4"} border border-slate-200 shadow-sm ${className ?? ""}`}>
      <div className="flex items-center gap-2 mb-2.5">
        <Calendar className={`w-4 h-4 ${a.icon}`} />
        <h3 className="font-semibold text-slate-800 text-sm">সময় ফিল্টার</h3>
        {(from || to) && (
          <button onClick={clear} className="ml-auto text-xs text-slate-500 hover:text-rose-600 inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-rose-50">
            <X className="w-3 h-3" /> রিসেট
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {presets.map((p) => (
          <button
            key={p.k}
            onClick={() => setView(p.k)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${view === p.k ? a.active : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
          >
            {p.bn}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">
          <span className="block text-slate-500 mb-0.5">শুরু</span>
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className={`w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 ${a.ring}`}
          />
        </label>
        <label className="text-xs">
          <span className="block text-slate-500 mb-0.5">শেষ</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className={`w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 ${a.ring}`}
          />
        </label>
      </div>
      {showGranularity && onGranularityChange && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">গ্রুপিং ভিউ</div>
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
                onClick={() => onGranularityChange(g.k)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${granularity === g.k ? a.active : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
              >
                {g.bn}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}