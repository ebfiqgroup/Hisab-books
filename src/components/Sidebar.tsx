import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home, Wallet, TrendingDown, ArrowLeftRight, Clock, Target,
  Users, BarChart3, Calendar, Settings, ShieldCheck, Activity, LifeBuoy,
} from "lucide-react";
import { useIsAdmin } from "@/hooks/useRole";

const navItems = [
  { icon: Home, label: "ড্যাশবোর্ড", to: "/app" },
  { icon: Wallet, label: "আয়", to: "/income" },
  { icon: TrendingDown, label: "ব্যয়", to: "/expense" },
  { icon: ArrowLeftRight, label: "লেনদেন", to: "/transactions" },
  { icon: Clock, label: "বাজেট", to: "/budget" },
  { icon: Target, label: "লক্ষ্য", to: "/goals" },
  { icon: Users, label: "পাওনা/দেনা", to: "/debts" },
  { icon: BarChart3, label: "রিপোর্ট", to: "/report" },
  { icon: Calendar, label: "ক্যালেন্ডার", to: "/calendar" },
  { icon: LifeBuoy, label: "সাপোর্ট", to: "/support" },
  { icon: Settings, label: "সেটিংস", to: "/settings" },
];

export function Sidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = useIsAdmin();
  const items = isAdmin
    ? [
        ...navItems,
        { icon: ShieldCheck, label: "অ্যাডমিন", to: "/admin" as const },
        { icon: Activity, label: "অডিট লগ", to: "/audit" as const },
      ]
    : navItems;
  return (
    <aside className="w-64 flex flex-col h-screen sticky top-0 overflow-y-auto relative" style={{ background: "var(--gradient-sidebar)", color: "var(--brand-ivory)" }}>
      <div className="absolute inset-y-0 right-0 w-px" style={{ background: "linear-gradient(180deg, transparent, color-mix(in oklab, var(--brand-gold-500) 50%, transparent), transparent)" }} />
      <div className="p-5 flex items-center gap-3 border-b border-white/10">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg" style={{ background: "color-mix(in oklab, var(--brand-gold-500) 22%, transparent)", border: "1px solid color-mix(in oklab, var(--brand-gold-500) 35%, transparent)" }}>
          <Wallet className="w-5 h-5" style={{ color: "var(--brand-gold-500)" }} />
        </div>
        <div>
          <div className="text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>আমার হিসাব</div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">Personal Finance</div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {items.map((n, i) => {
          const active = path === n.to;
          return (
            <Link
              key={i}
              to={n.to}
              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${active ? "text-white shadow-md" : "text-white/65 hover:text-white hover:bg-white/5"}`}
              style={active ? { background: "color-mix(in oklab, var(--brand-gold-500) 18%, transparent)", border: "1px solid color-mix(in oklab, var(--brand-gold-500) 35%, transparent)" } : undefined}
            >
              {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full" style={{ background: "var(--brand-gold-500)" }} />}
              <n.icon className="w-4 h-4" style={active ? { color: "var(--brand-gold-500)" } : undefined} />
              <span className="font-medium">{n.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mx-4 mb-4 p-4 rounded-xl relative overflow-hidden" style={{ background: "color-mix(in oklab, var(--brand-gold-500) 10%, transparent)", border: "1px solid color-mix(in oklab, var(--brand-gold-500) 25%, transparent)" }}>
        <span className="absolute -top-2 left-3 text-4xl leading-none" style={{ color: "color-mix(in oklab, var(--brand-gold-500) 60%, transparent)", fontFamily: "var(--font-display)" }}>"</span>
        <p className="text-xs text-white/85 leading-relaxed pt-2" style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "0.95rem" }}>
          আর্থিক শৃঙ্খলাই<br/>সফলতার চাবিকাঠি
        </p>
      </div>
    </aside>
  );
}