import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Home, Wallet, TrendingDown, ArrowLeftRight, Clock, Target,
  Users, BarChart3, Calendar, Settings, ShieldCheck, Activity, LifeBuoy, X, StickyNote, Crown,
} from "lucide-react";
import { useIsAdmin, useIsSuperAdmin } from "@/hooks/useRole";
import { RefCodeBadge } from "./RefCodeBadge";
import { useLanguage, type TKey } from "@/hooks/useLanguage";

const navItems: { icon: typeof Home; key: TKey; to: string }[] = [
  { icon: Home, key: "nav.dashboard", to: "/app" },
  { icon: Wallet, key: "nav.income", to: "/income" },
  { icon: TrendingDown, key: "nav.expense", to: "/expense" },
  { icon: ArrowLeftRight, key: "nav.transactions", to: "/transactions" },
  { icon: Clock, key: "nav.budget", to: "/budget" },
  { icon: Target, key: "nav.goals", to: "/goals" },
  { icon: Users, key: "nav.debts", to: "/debts" },
  { icon: BarChart3, key: "nav.report", to: "/report" },
  { icon: StickyNote, key: "nav.notes", to: "/notes" },
  { icon: LifeBuoy, key: "nav.support", to: "/support" },
  { icon: Settings, key: "nav.settings", to: "/settings" },
  { icon: Calendar, key: "nav.calendar", to: "/calendar" },
];

export function Sidebar({ mobileOpen = false, onClose }: { mobileOpen?: boolean; onClose?: () => void } = {}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = useIsAdmin();
  const isSuperAdmin = useIsSuperAdmin();
  const { t } = useLanguage();
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [mobileOpen, onClose]);
  const items = [
    ...navItems,
    ...(isAdmin ? [{ icon: ShieldCheck, key: "nav.admin" as TKey, to: "/admin" as const }] : []),
    ...(isSuperAdmin ? [{ icon: Crown, key: "nav.superAdmin" as TKey, to: "/super-admin" as const }] : []),
    ...(isAdmin ? [{ icon: Activity, key: "nav.audit" as TKey, to: "/audit" as const }] : []),
  ];
  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`w-64 flex-col h-screen overflow-y-auto bg-clip-border z-50 transition-transform duration-300
          lg:sticky lg:top-0 lg:flex lg:translate-x-0 lg:relative
          ${mobileOpen
            ? "fixed top-0 left-0 flex translate-x-0"
            : "hidden -translate-x-full"}`}
        style={{
          background: "var(--sidebar-luminous-bg)",
          color: "var(--brand-ink)",
          boxShadow: "inset -1px 0 0 color-mix(in oklab, var(--brand-gold-500) 25%, var(--brand-line))",
        }}
      >
      {/* Top-left luminous highlight sheen */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(90% 50% at 0% 0%, color-mix(in oklab, white 60%, transparent) 0%, transparent 50%)",
        mixBlendMode: "screen",
        opacity: 0.6,
      }} />
      {/* Right-edge glow strip */}
      <div className="absolute inset-y-0 right-0 w-[2px]" style={{ background: "var(--sidebar-glow-right)" }} />

      <div className="relative z-10 flex flex-col h-full">
      <div className="p-5 flex items-center gap-3 border-b relative" style={{ borderColor: "var(--brand-line)" }}>
        {/* Logo icon with soft glow */}
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg relative" style={{
          background: "color-mix(in oklab, var(--brand-emerald-600) 12%, transparent)",
          border: "1px solid color-mix(in oklab, var(--brand-emerald-600) 30%, transparent)",
          boxShadow: "0 0 20px -4px color-mix(in oklab, var(--brand-emerald-500) 45%, transparent), 0 2px 8px -2px color-mix(in oklab, var(--brand-emerald-900) 15%, transparent)",
        }}>
          <Wallet className="w-5 h-5" style={{ color: "var(--brand-emerald-700)" }} />
        </div>
        <div className="flex-1">
          <div className="text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--brand-ink)" }}>{t("brand.title")}</div>
          <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--brand-ink-soft)" }}>{t("brand.subtitle")}</div>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-md hover:bg-black/5"
          style={{ color: "var(--brand-ink-soft)" }}
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {items.map((n, i) => {
          const active = path === n.to;
          return (
            <Link
              key={i}
              to={n.to}
              onClick={onClose}
              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${active ? "shadow-md" : "hover:bg-black/[0.03]"}`}
              style={active
                ? {
                    background: "color-mix(in oklab, var(--brand-emerald-500) 10%, transparent)",
                    border: "1px solid color-mix(in oklab, var(--brand-emerald-500) 35%, transparent)",
                    color: "var(--brand-emerald-800)",
                    boxShadow: "0 0 18px -6px color-mix(in oklab, var(--brand-emerald-500) 45%, transparent), inset 0 1px 0 color-mix(in oklab, white 60%, transparent)",
                  }
                : { color: "var(--brand-ink-soft)" }}
            >
              {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full shadow-[0_0_10px_-2px_var(--brand-emerald-500)]" style={{ background: "var(--brand-emerald-600)" }} />}
              <n.icon className="w-4 h-4" style={active ? { color: "var(--brand-emerald-700)", filter: "drop-shadow(0 0 3px color-mix(in oklab, var(--brand-emerald-500) 50%, transparent))" } : undefined} />
              <span className="font-medium">{t(n.key)}</span>
            </Link>
          );
        })}
      </nav>
      <RefCodeBadge variant="sidebar" />
      <div className="mx-4 mb-4 p-4 rounded-xl relative overflow-hidden" style={{ background: "color-mix(in oklab, var(--brand-gold-300) 15%, transparent)", border: "1px solid color-mix(in oklab, var(--brand-gold-500) 20%, var(--brand-line))" }}>
        <span className="absolute -top-2 left-3 text-4xl leading-none" style={{ color: "color-mix(in oklab, var(--brand-gold-500) 50%, transparent)", fontFamily: "var(--font-display)" }}>"</span>
        <p className="text-xs leading-relaxed pt-2 whitespace-pre-line" style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "0.95rem", color: "var(--brand-ink-soft)" }}>
          {t("brand.quote")}
        </p>
      </div>
      </div>
      </aside>
    </>
  );
}