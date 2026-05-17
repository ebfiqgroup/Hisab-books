import { ReactNode, useState, useRef, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Bell, ChevronDown, LogOut, User as UserIcon, Settings as SettingsIcon, LifeBuoy, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate, useRouter, useLocation } from "@tanstack/react-router";
import { RefCodeBadge } from "./RefCodeBadge";
import { useLanguage } from "@/hooks/useLanguage";

export function AppShell({ title, actions, children }: { title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const location = useLocation();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) { setMenuOpen(false); setBellOpen(false); }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const name = (user?.user_metadata?.full_name as string) || user?.email?.split("@")[0] || t("header.you");

  const showBack = location.pathname !== "/app" && location.pathname !== "/";
  const goBack = () => {
    if (window.history.length > 1) router.history.back();
    else navigate({ to: "/app" });
  };

  const doSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="h-[100dvh] lg:h-screen flex overflow-hidden min-h-0 min-w-0" style={{ background: "var(--gradient-page)" }}>
      <Sidebar mobileOpen={navOpen} onClose={() => setNavOpen(false)} />
      <main className="flex-1 p-2 sm:p-3 lg:p-6 overflow-y-auto overflow-x-hidden h-full w-full min-w-0 min-h-0">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-3 mb-4 lg:mb-6" ref={ref}>
          <div className="flex items-center gap-2 md:gap-3 min-w-0 w-full lg:w-auto">
            <button
              onClick={() => setNavOpen(true)}
              className="lg:hidden p-2 bg-white rounded-lg border hover:shadow-sm transition shrink-0 flex flex-col gap-[3px] items-center justify-center w-9 h-9"
              style={{ borderColor: "var(--brand-line)" }}
              aria-label="মেনু খুলুন"
            >
              <span className="block w-4 h-[2px] rounded" style={{ background: "var(--brand-ink)" }} />
              <span className="block w-4 h-[2px] rounded" style={{ background: "var(--brand-ink)" }} />
              <span className="block w-4 h-[2px] rounded" style={{ background: "var(--brand-ink)" }} />
            </button>
            {showBack && (
              <button
                onClick={goBack}
                title={t("ফিরে যান", "Back")}
                aria-label={t("ফিরে যান", "Back")}
                className="p-2 bg-white rounded-lg border hover:shadow-sm transition shrink-0 w-9 h-9 flex items-center justify-center"
                style={{ borderColor: "var(--brand-line)" }}
              >
                <ArrowLeft className="w-4 h-4" style={{ color: "var(--brand-ink-soft)" }} />
              </button>
            )}
            <span className="hidden md:block h-7 w-1 rounded-full" style={{ background: "var(--gradient-brand)" }} />
            <h1 className="text-lg md:text-2xl lg:text-3xl tracking-tight truncate flex-1 min-w-0" style={{ fontFamily: "var(--font-display)", color: "var(--brand-ink)" }}>{title}</h1>
          </div>
          {actions && (
            <div className="flex items-center gap-2 flex-wrap w-full lg:hidden">
              {actions}
            </div>
          )}
          <div className="flex items-center gap-2 md:gap-3 flex-wrap w-full lg:w-auto lg:justify-end">
            <div className="hidden lg:flex items-center gap-2 md:gap-3 flex-wrap">{actions}</div>
            <Link
              to="/support"
              title={t("nav.support")}
              aria-label={t("nav.support")}
              className="p-2 bg-white rounded-lg border hover:shadow-sm transition"
              style={{ borderColor: "var(--brand-line)" }}
            >
              <LifeBuoy className="w-4 h-4" style={{ color: "var(--brand-ink-soft)" }} />
            </Link>
            <div className="relative">
              <button onClick={() => { setBellOpen(o => !o); setMenuOpen(false); }} className="relative p-2 bg-white rounded-lg border hover:shadow-sm transition" style={{ borderColor: "var(--brand-line)" }}>
                <Bell className="w-4 h-4" style={{ color: "var(--brand-ink-soft)" }} />
              </button>
              {bellOpen && (
                <div className="absolute right-0 top-12 w-72 bg-white rounded-xl p-3 z-50 brand-card">
                  <div className="text-sm font-semibold mb-2" style={{ color: "var(--brand-ink)" }}>{t("header.notifications")}</div>
                  <div className="text-xs text-slate-500 py-6 text-center">{t("header.noNotifications")}</div>
                </div>
              )}
            </div>
            <div className="relative">
              <button onClick={() => { setMenuOpen(o => !o); setBellOpen(false); }} className="flex items-center gap-2 px-2 py-1 bg-white rounded-lg border hover:shadow-sm transition" style={{ borderColor: "var(--brand-line)" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: "var(--gradient-brand)" }}>
                  {name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm hidden sm:inline max-w-[120px] truncate">{name}</span>
                <ChevronDown className="w-4 h-4" style={{ color: "var(--brand-ink-soft)" }} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-12 w-56 bg-white rounded-xl p-1 z-50 brand-card">
                  <div className="px-3 py-2 border-b" style={{ borderColor: "var(--brand-line)" }}>
                    <div className="text-sm font-semibold truncate" style={{ color: "var(--brand-ink)" }}>{name}</div>
                    <div className="text-xs text-slate-500 truncate">{user?.email}</div>
                  </div>
                  <RefCodeBadge variant="menu" />
                  <Link to="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md">
                    <UserIcon className="w-4 h-4" /> {t("header.profile")}
                  </Link>
                  <Link to="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md">
                    <SettingsIcon className="w-4 h-4" /> {t("header.settings")}
                  </Link>
                  <button onClick={doSignOut} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-md">
                    <LogOut className="w-4 h-4" /> {t("header.signOut")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}