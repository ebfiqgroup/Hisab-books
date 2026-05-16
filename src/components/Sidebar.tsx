import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home, Wallet, TrendingDown, ArrowLeftRight, Clock, Target,
  Users, BarChart3, Calendar, Settings,
} from "lucide-react";

const navItems = [
  { icon: Home, label: "ড্যাশবোর্ড", to: "/" },
  { icon: Wallet, label: "আয়", to: "/income" },
  { icon: TrendingDown, label: "ব্যয়", to: "/expense" },
  { icon: ArrowLeftRight, label: "লেনদেন", to: "/transactions" },
  { icon: Clock, label: "বাজেট", to: "/budget" },
  { icon: Target, label: "লক্ষ্য", to: "/goals" },
  { icon: Users, label: "পাওনা/দেনা", to: "/debts" },
  { icon: BarChart3, label: "রিপোর্ট", to: "/report" },
  { icon: Calendar, label: "ক্যালেন্ডার", to: "/calendar" },
  { icon: Settings, label: "সেটিংস", to: "/settings" },
];

export function Sidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="w-64 flex flex-col text-white h-screen sticky top-0 overflow-y-auto" style={{ background: "oklch(0.22 0.04 250)" }}>
      <div className="p-5 flex items-center gap-3 border-b border-white/10">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <div className="font-bold text-base">আমার হিসাব</div>
          <div className="text-xs text-white/60">মাসিক ড্যাশবোর্ড</div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((n, i) => {
          const active = path === n.to;
          return (
            <Link
              key={i}
              to={n.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition ${active ? "bg-indigo-600 text-white" : "text-white/70 hover:bg-white/5"}`}
            >
              <n.icon className="w-4 h-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="m-4 p-4 rounded-lg border border-white/15 text-xs text-white/80 relative">
        <span className="absolute -top-1 left-3 text-2xl text-white/30">"</span>
        আর্থিক শৃঙ্খলা<br/>সফলতার চাবিকাঠি
      </div>
      <div className="h-32 relative overflow-hidden">
        <div className="absolute bottom-0 left-2 text-5xl">🪴</div>
      </div>
    </aside>
  );
}